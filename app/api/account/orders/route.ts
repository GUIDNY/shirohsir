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
      "id, song_type, recipient, occasion, style, status, mode, prompt_preview, audio_url, song_length_seconds, credits_cost, photo_url, share_token, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "שגיאה בטעינת ההזמנות" }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: versionRows } = orderIds.length
    ? await supabase
        .from("song_versions")
        .select("order_id, version_label, audio_url")
        .in("order_id", orderIds)
    : { data: [] as { order_id: string; version_label: string; audio_url: string | null }[] };

  const withSignedAudio = await Promise.all(
    (orders ?? []).map(async (order) => {
      const versionsForOrder = (versionRows ?? []).filter((row) => row.order_id === order.id);

      // New (post song_versions) orders: sign each version's audio path.
      if (versionsForOrder.length > 0) {
        const versions = await Promise.all(
          versionsForOrder.map(async (row) => {
            if (!row.audio_url) {
              return { label: row.version_label, audioSignedUrl: null };
            }

            const { data: signed } = await supabase.storage
              .from("songs")
              .createSignedUrl(row.audio_url, SIGNED_URL_TTL_SECONDS);

            return { label: row.version_label, audioSignedUrl: signed?.signedUrl ?? null };
          }),
        );

        return { ...order, versions, audioSignedUrl: versions[0]?.audioSignedUrl ?? null };
      }

      // Older orders from before versions existed: a single audio_url.
      if (!order.audio_url) {
        return { ...order, versions: [], audioSignedUrl: null };
      }

      const { data: signed } = await supabase.storage
        .from("songs")
        .createSignedUrl(order.audio_url, SIGNED_URL_TTL_SECONDS);

      return {
        ...order,
        versions: [{ label: "", audioSignedUrl: signed?.signedUrl ?? null }],
        audioSignedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return NextResponse.json({ orders: withSignedAudio }, { headers: { "Cache-Control": "no-store" } });
}
