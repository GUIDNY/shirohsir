import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { DUMMY_BILLING_CAP_CREDITS, findPricingPlan } from "@/lib/pricing-catalog";
import { createServerClient } from "@/lib/supabase-server";

// One-time purchases only (the single song + the two credit packs).
// Subscriptions go through /api/billing/subscribe instead, since they
// also need a recurring `subscriptions` row.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { productId?: string; idempotencyKey?: string } | null;
  const plan = body?.productId ? findPricingPlan(body.productId) : undefined;
  const idempotencyKey = (body?.idempotencyKey || "").trim();

  if (!plan || plan.isSubscription) {
    return NextResponse.json({ error: "המוצר לא נמצא" }, { status: 400 });
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Idempotent: a retried click/request with the same key returns the
  // already-completed purchase instead of charging/granting again.
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

  // Real payment isn't connected yet — this simulates a completed
  // checkout. Cap total lifetime dummy grants per account so it can't
  // be abused as a free-credits faucet on the live site in the meantime.
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

  const reason = plan.productType === "single_song" ? "single_song_purchase" : "pack_purchase";

  const { error: paymentError } = await supabase.from("payments").insert({
    user_id: user.id,
    idempotency_key: idempotencyKey,
    product_type: plan.productType,
    product_id: plan.id,
    amount_ils: plan.priceIls,
    credits_granted: plan.credits,
    status: "succeeded",
    payment_provider: "demo",
  });

  if (paymentError) {
    // Unique-constraint clash means a concurrent request with the same
    // key already recorded the payment — treat that as success too.
    if (paymentError.code !== "23505") {
      return NextResponse.json({ error: "שגיאה ברישום התשלום" }, { status: 500 });
    }
  }

  const { data: newBalance, error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: user.id,
    p_amount: plan.credits,
    p_reason: reason,
    p_note: plan.name,
    p_expires_at: null,
    p_idempotency_key: idempotencyKey,
  });

  if (grantError) {
    return NextResponse.json({ error: "שגיאה בהענקת קרדיטים" }, { status: 500 });
  }

  await supabase.rpc("grant_referral_bonus_if_eligible", { p_user_id: user.id });

  return NextResponse.json({ balance: newBalance, credits: plan.credits, planId: plan.id });
}
