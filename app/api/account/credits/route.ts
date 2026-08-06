import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { CREDITS_PER_SONG } from "@/lib/pricing-catalog";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const admin = isAdminUser(user);
  const supabase = createServerClient();

  // Settle any lots whose expiry has already passed before reading the
  // balance, so the wallet always reflects only still-valid credits —
  // see settle_expired_credits() in migration 8.
  await supabase.rpc("settle_expired_credits", { p_user_id: user.id });

  const { data: balanceRow } = await supabase
    .from("credit_balances")
    .select("balance, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan, status, monthly_credit_allowance, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("referral_code, share_bonus_claimed")
    .eq("id", user.id)
    .maybeSingle();

  const { data: demoUsageRow } = await supabase
    .from("free_demo_usage")
    .select("used_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: expiringLots } = await supabase
    .from("credit_lots")
    .select("remaining, expires_at")
    .eq("user_id", user.id)
    .gt("remaining", 0)
    .not("expires_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });

  let expiringSoon: { amount: number; date: string } | null = null;

  if (expiringLots && expiringLots.length > 0) {
    const nearestDate = expiringLots[0].expires_at as string;
    const amount = expiringLots
      .filter((lot) => lot.expires_at === nearestDate)
      .reduce((sum, lot) => sum + lot.remaining, 0);

    expiringSoon = { amount, date: nearestDate };
  }

  const balance = balanceRow?.balance ?? 0;

  return NextResponse.json(
    {
      email: user.email,
      isAdmin: admin,
      unlimited: admin,
      balance,
      songsAvailable: Math.floor(balance / CREDITS_PER_SONG),
      leftoverCredits: balance % CREDITS_PER_SONG,
      expiringSoon,
      updatedAt: balanceRow?.updated_at ?? null,
      subscription: subscriptionRow ?? null,
      referralCode: profileRow?.referral_code ?? null,
      shareBonusClaimed: profileRow?.share_bonus_claimed === true,
      freeDemoUsed: !!demoUsageRow,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
