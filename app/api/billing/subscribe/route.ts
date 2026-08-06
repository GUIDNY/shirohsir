import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { DUMMY_BILLING_CAP_CREDITS, findPricingPlan, SUBSCRIPTION_CREDIT_VALIDITY_DAYS } from "@/lib/pricing-catalog";
import { createServerClient } from "@/lib/supabase-server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const VALIDITY_MS = SUBSCRIPTION_CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { productId?: string; idempotencyKey?: string } | null;
  const plan = body?.productId ? findPricingPlan(body.productId) : undefined;
  const idempotencyKey = (body?.idempotencyKey || "").trim();

  if (!plan || !plan.isSubscription) {
    return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 400 });
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const supabase = createServerClient();
  const now = new Date();

  // Idempotent: a retried click/request with the same key returns the
  // already-completed subscription instead of charging/granting again.
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("credits_granted")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingPayment) {
    const { data: balanceRow } = await supabase
      .from("credit_balances")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ balance: balanceRow?.balance ?? 0, credits: existingPayment.credits_granted, planId: plan.id });
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const alreadyActiveSamePlan =
    existing && existing.plan === plan.id && existing.current_period_end && new Date(existing.current_period_end) > now;

  if (alreadyActiveSamePlan) {
    return NextResponse.json({ error: "המסלול הזה כבר פעיל החודש", code: "already_active" }, { status: 409 });
  }

  // Same demo-abuse guard as one-time purchases — see /api/billing/purchase.
  const { data: grantedRows } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", user.id)
    .in("reason", ["pack_purchase", "single_song_purchase", "subscription_grant"]);

  const alreadyGranted = (grantedRows ?? []).reduce((sum, row) => sum + row.delta, 0);

  if (alreadyGranted + plan.credits > DUMMY_BILLING_CAP_CREDITS) {
    return NextResponse.json(
      {
        error: "הגעת למגבלת הדגמה זמנית — נחבר סליקה אמיתית בקרוב. אפשר לפנות אלינו בינתיים.",
        code: "demo_cap_reached",
      },
      { status: 403 },
    );
  }

  const periodEnd = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();
  const creditsExpireAt = new Date(now.getTime() + VALIDITY_MS).toISOString();

  const subscriptionRow = {
    user_id: user.id,
    plan: plan.id,
    status: "active",
    monthly_credit_allowance: plan.credits,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
    payment_provider: "demo",
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  };

  const { error: subscriptionError } = existing
    ? await supabase.from("subscriptions").update(subscriptionRow).eq("id", existing.id)
    : await supabase.from("subscriptions").insert(subscriptionRow);

  if (subscriptionError) {
    return NextResponse.json({ error: "שגיאה ביצירת המנוי" }, { status: 500 });
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    user_id: user.id,
    idempotency_key: idempotencyKey,
    product_type: "subscription",
    product_id: plan.id,
    amount_ils: plan.priceIls,
    credits_granted: plan.credits,
    status: "succeeded",
    payment_provider: "demo",
  });

  if (paymentError && paymentError.code !== "23505") {
    return NextResponse.json({ error: "שגיאה ברישום התשלום" }, { status: 500 });
  }

  const { data: newBalance, error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: user.id,
    p_amount: plan.credits,
    p_reason: "subscription_grant",
    p_note: plan.name,
    p_expires_at: creditsExpireAt,
    p_idempotency_key: idempotencyKey,
  });

  if (grantError) {
    return NextResponse.json({ error: "שגיאה בהענקת קרדיטים" }, { status: 500 });
  }

  await supabase.rpc("grant_referral_bonus_if_eligible", { p_user_id: user.id });

  return NextResponse.json({
    balance: newBalance,
    planId: plan.id,
    credits: plan.credits,
    periodEnd,
    creditsExpireAt,
  });
}
