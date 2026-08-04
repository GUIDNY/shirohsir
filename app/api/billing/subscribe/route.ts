import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { DUMMY_BILLING_CAP_CREDITS, subscriptionPlans } from "@/lib/billing-catalog";
import { createServerClient } from "@/lib/supabase-server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { planId?: string } | null;
  const plan = subscriptionPlans.find((candidate) => candidate.id === body?.planId);

  if (!plan) {
    return NextResponse.json({ error: "מנוי לא נמצא" }, { status: 400 });
  }

  const supabase = createServerClient();
  const now = new Date();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing && existing.plan === plan.id && existing.current_period_end && new Date(existing.current_period_end) > now) {
    return NextResponse.json({ error: "המנוי הזה כבר פעיל החודש", code: "already_active" }, { status: 409 });
  }

  // Same demo-abuse guard as pack purchases — see /api/billing/purchase.
  const { data: grantedRows } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", user.id)
    .in("reason", ["pack_purchase", "subscription_grant"]);

  const alreadyGranted = (grantedRows ?? []).reduce((sum, row) => sum + row.delta, 0);

  if (alreadyGranted + plan.monthlyCredits > DUMMY_BILLING_CAP_CREDITS) {
    return NextResponse.json(
      {
        error: "הגעת למגבלת הדגמה זמנית — נחבר סליקה אמיתית בקרוב. אפשר לפנות אלינו בינתיים.",
        code: "demo_cap_reached",
      },
      { status: 403 },
    );
  }

  const periodEnd = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();

  const subscriptionRow = {
    user_id: user.id,
    plan: plan.id,
    status: "active",
    monthly_credit_allowance: plan.monthlyCredits,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
    payment_provider: "demo",
    updated_at: now.toISOString(),
  };

  const { error: subscriptionError } = existing
    ? await supabase.from("subscriptions").update(subscriptionRow).eq("id", existing.id)
    : await supabase.from("subscriptions").insert(subscriptionRow);

  if (subscriptionError) {
    return NextResponse.json({ error: "שגיאה ביצירת המנוי" }, { status: 500 });
  }

  const { data: newBalance, error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: user.id,
    p_amount: plan.monthlyCredits,
    p_reason: "subscription_grant",
    p_note: `demo subscribe: ${plan.id}`,
  });

  if (grantError) {
    return NextResponse.json({ error: "שגיאה בהענקת קרדיטים" }, { status: 500 });
  }

  return NextResponse.json({
    mode: "demo",
    balance: newBalance,
    planId: plan.id,
    credits: plan.monthlyCredits,
    periodEnd,
  });
}
