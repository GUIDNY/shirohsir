import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { createServerClient } from "@/lib/supabase-server";

// Cancels the next renewal. Credits already granted stay usable until
// their own expiry (never deleted by cancellation) — see the
// cancel_at_period_end column added in migration 8.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "אין מנוי פעיל לביטול" }, { status: 404 });
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) {
    return NextResponse.json({ error: "שגיאה בביטול המנוי" }, { status: 500 });
  }

  return NextResponse.json({ canceled: true, activeUntil: existing.current_period_end });
}
