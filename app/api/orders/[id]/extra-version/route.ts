import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { EXTRA_VERSION_CREDITS, MAX_VERSION_SECONDS } from "@/lib/pricing-catalog";
import { createServerClient } from "@/lib/supabase-server";
import { createSongVersion, MusicProviderError, uploadSongAudio } from "@/lib/song-generation";

const VERSION_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];

export async function POST(request: NextRequest, ctx: RouteContext<"/api/orders/[id]/extra-version">) {
  const { id: orderId } = await ctx.params;
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { idempotencyKey?: string } | null;
  const idempotencyKey = (body?.idempotencyKey || "").trim();
  const admin = isAdminUser(user);

  if (!admin && !idempotencyKey) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, user_id, song_type, recipient, occasion, style, mood, vocalist, language_register, lyric_structure, pronunciation, story, must_include, avoid, song_length_seconds, recipient_gender",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order.user_id !== user.id && !admin)) {
    return NextResponse.json({ error: "ההזמנה לא נמצאה" }, { status: 404 });
  }

  if (!admin) {
    const { error: spendError } = await supabase.rpc("spend_credits", {
      p_user_id: user.id,
      p_amount: EXTRA_VERSION_CREDITS,
      p_reason: "extra_version",
      p_order_id: orderId,
      p_note: "גרסה נוספת",
      p_idempotency_key: idempotencyKey,
    });

    if (spendError) {
      if (spendError.message.includes("insufficient_credits")) {
        return NextResponse.json(
          { error: "חסרים לך קרדיטים ליצירת גרסה נוספת", code: "insufficient_credits", required: EXTRA_VERSION_CREDITS },
          { status: 402 },
        );
      }

      return NextResponse.json({ error: "שגיאה בחיוב הקרדיטים" }, { status: 500 });
    }
  }

  const { count: existingVersionCount } = await supabase
    .from("song_versions")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  const label = VERSION_LABELS[existingVersionCount ?? 0] || `${(existingVersionCount ?? 0) + 1}`;

  const recipientGender: "male" | "female" = order.recipient_gender === "female" ? "female" : "male";
  const orderContent = {
    songType: order.song_type,
    recipient: order.recipient,
    occasion: order.occasion,
    style: order.style,
    mood: order.mood,
    vocalist: order.vocalist,
    languageRegister: order.language_register,
    lyricStructure: order.lyric_structure,
    pronunciation: order.pronunciation,
    story: order.story,
    mustInclude: order.must_include,
    avoid: order.avoid,
    recipientGender,
  };

  try {
    const version = await createSongVersion(orderContent, order.song_length_seconds ?? MAX_VERSION_SECONDS, label);
    const audioPath =
      version.audioDataUrl && version.audioContentType
        ? await uploadSongAudio(supabase, user.id, orderId, label, version.audioDataUrl, version.audioContentType)
        : null;

    await supabase.from("song_versions").insert({
      order_id: orderId,
      version_label: label,
      audio_url: audioPath,
      credits_cost: admin ? 0 : EXTRA_VERSION_CREDITS,
    });

    const { data: balanceRow } = await supabase
      .from("credit_balances")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ version, balance: balanceRow?.balance ?? 0 });
  } catch (error) {
    if (!admin) {
      await supabase.rpc("grant_credits", {
        p_user_id: user.id,
        p_amount: EXTRA_VERSION_CREDITS,
        p_reason: "refund",
        p_note: "החזר בעקבות תקלה בגרסה נוספת",
        p_expires_at: null,
        p_idempotency_key: `refund_${idempotencyKey}`,
      });
    }

    if (error instanceof MusicProviderError) {
      return NextResponse.json(
        { error: "תקלה זמנית ביצירת הגרסה — הקרדיטים הוחזרו לחשבון שלך.", refunded: true },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: "שגיאה ביצירת הגרסה הנוספת" }, { status: 500 });
  }
}
