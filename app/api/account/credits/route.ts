import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const admin = isAdminUser(user);
  const supabase = createServerClient();
  const { data: balanceRow } = await supabase
    .from("credit_balances")
    .select("balance, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan, status, monthly_credit_allowance, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("referral_code, share_bonus_claimed")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      email: user.email,
      isAdmin: admin,
      unlimited: admin,
      balance: balanceRow?.balance ?? 0,
      updatedAt: balanceRow?.updated_at ?? null,
      subscription: subscriptionRow ?? null,
      referralCode: profileRow?.referral_code ?? null,
      shareBonusClaimed: profileRow?.share_bonus_claimed === true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
