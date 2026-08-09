import { timingSafeEqual, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { findPricingPlan } from "@/lib/pricing-catalog";
import { LEMONSQUEEZY_VARIANT_TO_PLAN } from "@/lib/lemonsqueezy-catalog";
import { createServerClient } from "@/lib/supabase-server";

// Real Lemon Squeezy webhook handler. Replaces the dummy
// /api/billing/purchase and /api/billing/subscribe routes, which just
// simulated a completed checkout — crediting now only ever happens here,
// triggered by Lemon Squeezy itself confirming a real payment.
//
// Signature verification: X-Signature header is an HMAC-SHA256 hex
// digest of the RAW request body — this is why we read request.text()
// and never request.json() (JSON.stringify(await request.json()) is
// not guaranteed to byte-for-byte match what Lemon Squeezy signed).
//
// Idempotency: every event is keyed "{event_name}:{data.id}" and checked
// against processed_webhooks before any event-specific logic runs, so a
// retried delivery (Lemon Squeezy retries until it gets a 200) is a
// harmless no-op. grant_credits()'s own p_idempotency_key (fed the same
// key) is a second, independent guard at the DB-write level.

type LemonSqueezyPayload = {
  meta: {
    event_name: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function alreadyProcessed(supabase: ReturnType<typeof createServerClient>, key: string) {
  const { data } = await supabase.from("processed_webhooks").select("id").eq("id", key).maybeSingle();
  return Boolean(data);
}

async function markProcessed(supabase: ReturnType<typeof createServerClient>, key: string, eventName: string) {
  await supabase.from("processed_webhooks").insert({ id: key, event_name: eventName });
}

function planForVariant(variantId: unknown) {
  const planId = LEMONSQUEEZY_VARIANT_TO_PLAN[String(variantId)];
  return planId ? findPricingPlan(planId) : undefined;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: LemonSqueezyPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const resourceId = payload.data?.id;

  if (!eventName || !resourceId) {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const webhookKey = `${eventName}:${resourceId}`;
  const supabase = createServerClient();

  try {
    if (await alreadyProcessed(supabase, webhookKey)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    switch (eventName) {
      case "order_created":
        await handleOrderCreated(supabase, payload, webhookKey);
        break;
      case "subscription_created":
        await handleSubscriptionCreated(supabase, payload, webhookKey);
        break;
      case "subscription_payment_success":
        await handleSubscriptionPaymentSuccess(supabase, payload, webhookKey);
        break;
      case "subscription_cancelled":
      case "subscription_expired":
        await handleSubscriptionEnded(supabase, payload, eventName);
        break;
      case "subscription_payment_failed":
        await handleSubscriptionPaymentFailed(supabase, payload);
        break;
      default:
        // Unhandled event type — not an error, just nothing to do.
        break;
    }

    await markProcessed(supabase, webhookKey, eventName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 500 so Lemon Squeezy retries — processed_webhooks was never
    // written for this key, so the retry runs the handler again cleanly.
    console.error(`[LEMONSQUEEZY_WEBHOOK_ERROR] ${eventName} (${resourceId}):`, error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

async function handleOrderCreated(
  supabase: ReturnType<typeof createServerClient>,
  payload: LemonSqueezyPayload,
  webhookKey: string,
) {
  const userId = payload.meta.custom_data?.user_id;
  const firstOrderItem = payload.data.attributes.first_order_item as { variant_id?: unknown } | undefined;
  const plan = planForVariant(firstOrderItem?.variant_id);

  if (!userId || !plan || plan.isSubscription) {
    console.error(`[LEMONSQUEEZY_WEBHOOK] order_created missing user_id or unknown variant`, {
      userId,
      variantId: firstOrderItem?.variant_id,
    });
    return;
  }

  const reason = plan.productType === "single_song" ? "single_song_purchase" : "pack_purchase";

  const { error: paymentError } = await supabase.from("payments").insert({
    user_id: userId,
    idempotency_key: webhookKey,
    product_type: plan.productType,
    product_id: plan.id,
    amount_ils: plan.priceIls,
    credits_granted: plan.credits,
    status: "succeeded",
    payment_provider: "lemonsqueezy",
  });

  if (paymentError && paymentError.code !== "23505") {
    throw paymentError;
  }

  const { error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: plan.credits,
    p_reason: reason,
    p_note: plan.name,
    p_expires_at: null,
    p_idempotency_key: webhookKey,
  });

  if (grantError) {
    throw grantError;
  }

  await supabase.rpc("grant_referral_bonus_if_eligible", { p_user_id: userId });
}

async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createServerClient>,
  payload: LemonSqueezyPayload,
  webhookKey: string,
) {
  const userId = payload.meta.custom_data?.user_id;
  const attrs = payload.data.attributes as { variant_id?: unknown; renews_at?: string };
  const plan = planForVariant(attrs.variant_id);

  if (!userId || !plan || !plan.isSubscription) {
    console.error(`[LEMONSQUEEZY_WEBHOOK] subscription_created missing user_id or unknown variant`, {
      userId,
      variantId: attrs.variant_id,
    });
    return;
  }

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: plan.id,
      status: "active",
      monthly_credit_allowance: plan.credits,
      current_period_start: new Date().toISOString(),
      current_period_end: attrs.renews_at ?? null,
      payment_provider: "lemonsqueezy",
      cancel_at_period_end: false,
      lemonsqueezy_subscription_id: payload.data.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lemonsqueezy_subscription_id" },
  );

  if (subscriptionError) {
    throw subscriptionError;
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    user_id: userId,
    idempotency_key: webhookKey,
    product_type: "subscription",
    product_id: plan.id,
    amount_ils: plan.priceIls,
    credits_granted: plan.credits,
    status: "succeeded",
    payment_provider: "lemonsqueezy",
  });

  if (paymentError && paymentError.code !== "23505") {
    throw paymentError;
  }

  const creditsExpireAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: plan.credits,
    p_reason: "subscription_grant",
    p_note: plan.name,
    p_expires_at: creditsExpireAt,
    p_idempotency_key: webhookKey,
  });

  if (grantError) {
    throw grantError;
  }

  await supabase.rpc("grant_referral_bonus_if_eligible", { p_user_id: userId });
}

// Fires on every renewal (and the initial payment too, distinguished by
// billing_reason) — the initial one is skipped here since
// subscription_created already granted those credits; only "renewal"
// grants again. This is the renewal path the spec called out as easy to
// forget: without it, a customer is charged month 2 and gets nothing.
async function handleSubscriptionPaymentSuccess(
  supabase: ReturnType<typeof createServerClient>,
  payload: LemonSqueezyPayload,
  webhookKey: string,
) {
  const attrs = payload.data.attributes as { subscription_id?: unknown; billing_reason?: string };

  if (attrs.billing_reason !== "renewal") {
    return;
  }

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("user_id, plan")
    .eq("lemonsqueezy_subscription_id", String(attrs.subscription_id))
    .maybeSingle();

  if (!subscriptionRow) {
    console.error(`[LEMONSQUEEZY_WEBHOOK] subscription_payment_success: no local subscription for`, {
      subscriptionId: attrs.subscription_id,
    });
    return;
  }

  const plan = findPricingPlan(subscriptionRow.plan);

  if (!plan) {
    console.error(`[LEMONSQUEEZY_WEBHOOK] subscription_payment_success: unknown plan`, {
      plan: subscriptionRow.plan,
    });
    return;
  }

  const creditsExpireAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: subscriptionRow.user_id,
    p_amount: plan.credits,
    p_reason: "subscription_grant",
    p_note: `${plan.name} — חידוש חודשי`,
    p_expires_at: creditsExpireAt,
    p_idempotency_key: webhookKey,
  });

  if (grantError) {
    throw grantError;
  }

  await supabase
    .from("subscriptions")
    .update({ current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("lemonsqueezy_subscription_id", String(attrs.subscription_id));
}

async function handleSubscriptionEnded(
  supabase: ReturnType<typeof createServerClient>,
  payload: LemonSqueezyPayload,
  eventName: "subscription_cancelled" | "subscription_expired",
) {
  const status = eventName === "subscription_cancelled" ? "cancelled" : "expired";

  const { error } = await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("lemonsqueezy_subscription_id", payload.data.id);

  if (error) {
    throw error;
  }
}

async function handleSubscriptionPaymentFailed(supabase: ReturnType<typeof createServerClient>, payload: LemonSqueezyPayload) {
  const attrs = payload.data.attributes as { subscription_id?: unknown };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("lemonsqueezy_subscription_id", String(attrs.subscription_id));

  if (error) {
    throw error;
  }

  console.error(`[LEMONSQUEEZY_PAYMENT_FAILED] subscription ${attrs.subscription_id} payment failed`);
}
