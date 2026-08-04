import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { SHARE_BONUS_CREDITS } from "@/lib/billing-catalog";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("share_bonus_claimed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.share_bonus_claimed) {
    return NextResponse.json({ error: "כבר קיבלת את הבונוס הזה", code: "already_claimed" }, { status: 409 });
  }

  // Conditional update (only matches if still false) so two concurrent
  // claims from the same account can't both pass and double-grant.
  const { data: updatedRows, error: updateError } = await supabase
    .from("profiles")
    .update({ share_bonus_claimed: true })
    .eq("id", user.id)
    .eq("share_bonus_claimed", false)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: "שגיאה בהענקת הבונוס" }, { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: "כבר קיבלת את הבונוס הזה", code: "already_claimed" }, { status: 409 });
  }

  const { data: newBalance, error: grantError } = await supabase.rpc("grant_credits", {
    p_user_id: user.id,
    p_amount: SHARE_BONUS_CREDITS,
    p_reason: "share_bonus",
    p_note: "שיתוף בפייסבוק",
  });

  if (grantError) {
    return NextResponse.json({ error: "שגיאה בהענקת הבונוס" }, { status: 500 });
  }

  return NextResponse.json({ balance: newBalance, credits: SHARE_BONUS_CREDITS });
}
