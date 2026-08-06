import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 50;

// Maps internal ledger `reason` values to the customer-facing Hebrew
// label shown in "היסטוריית פעולות" — never show the raw reason string.
const REASON_LABELS: Record<string, string> = {
  single_song_purchase: "רכישת שיר בודד",
  pack_purchase: "רכישת חבילה",
  subscription_grant: "חידוש מנוי",
  song_production: "יצירת שיר",
  extra_version: "גרסה נוספת",
  lyrics_revision: "שינוי לאחר אישור המילים",
  refund: "החזר קרדיטים בעקבות תקלה",
  referral_bonus: "בונוס הזמנת חבר",
  referred_purchase_bonus: "בונוס הצטרפות דרך חבר",
  credits_expired: "פקיעת קרדיטים",
  signup_bonus: "בונוס הרשמה",
  referred_signup_bonus: "בונוס הרשמה דרך חבר",
  share_bonus: "בונוס שיתוף",
  legacy_balance: "יתרת פתיחה",
  manual_adjustment: "עדכון יתרה",
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from("credit_ledger")
    .select("id, delta, reason, note, balance_after, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    return NextResponse.json({ error: "שגיאה בטעינת ההיסטוריה" }, { status: 500 });
  }

  const history = (rows ?? []).map((row) => ({
    id: row.id,
    date: row.created_at,
    label: REASON_LABELS[row.reason] || "עדכון יתרה",
    note: row.note || "",
    delta: row.delta,
    balanceAfter: row.balance_after,
  }));

  return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
}
