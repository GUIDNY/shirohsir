import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { creditPacks, DUMMY_BILLING_CAP_CREDITS } from "@/lib/billing-catalog";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { packId?: string } | null;
  const pack = creditPacks.find((candidate) => candidate.id === body?.packId);

  if (!pack) {
    return NextResponse.json({ error: "חבילה לא נמצאה" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Real payment isn't connected yet — this simulates a purchase. Cap total
  // lifetime dummy grants per account so it can't be abused as a free-
  // credits faucet on the live site in the meantime.
  const { data: grantedRows } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", user.id)
    .in("reason", ["pack_purchase", "subscription_grant"]);

  const alreadyGranted = (grantedRows ?? []).reduce((sum, row) => sum + row.delta, 0);

  if (alreadyGranted + pack.credits > DUMMY_BILLING_CAP_CREDITS) {
    return NextResponse.json(
      {
        error: "הגעת למגבלת הדגמה זמנית — נחבר סליקה אמיתית בקרוב. אפשר לפנות אלינו בינתיים.",
        code: "demo_cap_reached",
      },
      { status: 403 },
    );
  }

  const { data: newBalance, error } = await supabase.rpc("grant_credits", {
    p_user_id: user.id,
    p_amount: pack.credits,
    p_reason: "pack_purchase",
    p_note: `demo purchase: ${pack.id}`,
  });

  if (error) {
    return NextResponse.json({ error: "שגיאה בהענקת קרדיטים" }, { status: 500 });
  }

  return NextResponse.json({ mode: "demo", balance: newBalance, packId: pack.id, credits: pack.credits });
}
