import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, song_type, recipient, occasion, style, status, provider, prompt_preview, audio_url, song_length_seconds, credits_cost, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "שגיאה בטעינת ההזמנות" }, { status: 500 });
  }

  const withSignedAudio = await Promise.all(
    (orders ?? []).map(async (order) => {
      if (!order.audio_url) {
        return { ...order, audioSignedUrl: null };
      }

      const { data: signed } = await supabase.storage
        .from("songs")
        .createSignedUrl(order.audio_url, SIGNED_URL_TTL_SECONDS);

      return { ...order, audioSignedUrl: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ orders: withSignedAudio }, { headers: { "Cache-Control": "no-store" } });
}
