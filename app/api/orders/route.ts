import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { CREDITS_PER_SONG, FREE_DEMO, MAX_VERSION_SECONDS, SONG_LENGTH_OPTIONS } from "@/lib/pricing-catalog";
import { createServerClient } from "@/lib/supabase-server";
import {
  createSongVersion,
  GeneratedVersion,
  inferSongAttributes,
  MusicProviderError,
  OrderContent,
  text,
  uploadSongAudio,
} from "@/lib/song-generation";

type OrderPayload = OrderContent & {
  moods?: string[];
  inspiration?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
  mode?: "demo" | "full";
  idempotencyKey?: string;
  songLengthSeconds?: number;
};

type OrderResponse = {
  orderId: string;
  mode: "demo" | "full";
  promptPreview: string;
  versions: GeneratedVersion[];
  refunded?: boolean;
};

// style/mood/vocalist/languageRegister/lyricStructure are no longer
// client-supplied — the customer only picks an occasion chip + up to 2
// mood chips and writes the story; inferSongAttributes() derives the rest
// (see lib/song-generation.ts) so the generation pipeline itself doesn't
// need to change.
const requiredFields: Array<keyof OrderPayload> = [
  "recipient",
  "occasion",
  "story",
  "customerName",
  "email",
  "phone",
  "recipientGender",
];

function orderInsertRow(
  orderId: string,
  userId: string,
  order: OrderPayload,
  mode: "demo" | "full",
  promptPreview: string,
  songSeconds: number,
  creditsCost: number,
) {
  return {
    id: orderId,
    user_id: userId,
    song_type: order.songType,
    recipient: text(order.recipient),
    occasion: text(order.occasion),
    style: text(order.style),
    mood: text(order.mood),
    vocalist: text(order.vocalist),
    language_register: text(order.languageRegister),
    lyric_structure: text(order.lyricStructure),
    pronunciation: text(order.pronunciation),
    story: text(order.story),
    must_include: text(order.mustInclude),
    avoid: text(order.avoid),
    customer_name: text(order.customerName),
    customer_email: text(order.email),
    customer_phone: text(order.phone),
    status: "delivered",
    mode,
    prompt_preview: promptPreview,
    song_length_seconds: songSeconds,
    credits_cost: creditsCost,
    recipient_gender: order.recipientGender === "female" ? "female" : "male",
  };
}

export async function POST(request: NextRequest) {
  const order = (await request.json()) as OrderPayload;
  const missing = requiredFields.filter((field) => !text(order[field]));

  if (missing.length > 0 || order.consent !== true) {
    return NextResponse.json(
      { error: "Missing required fields or rights confirmation", missing },
      { status: 400 },
    );
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "צריך להתחבר לפני יצירת שיר" }, { status: 401 });
  }

  const admin = isAdminUser(user);
  const supabase = createServerClient();
  const mode: "demo" | "full" = order.mode === "demo" ? "demo" : "full";

  // The customer only gave us an occasion + up to 2 mood chips + free text —
  // fill in the style/mood/vocalist/language/structure attributes the
  // existing lyric-writing and ElevenLabs pipeline expects.
  const inferred = inferSongAttributes({
    songType: order.songType,
    occasion: order.occasion,
    moods: order.moods,
    inspiration: order.inspiration,
  });
  const enrichedOrder: OrderPayload = {
    ...order,
    ...inferred,
    recipientGender: order.recipientGender === "female" ? "female" : "male",
  };

  try {
    if (mode === "demo") {
      if (!admin) {
        const { data: usedRow } = await supabase
          .from("free_demo_usage")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (usedRow) {
          return NextResponse.json(
            { error: "כבר יצרתם את הדמו החינמי שלכם — אפשר לרכוש שיר מלא.", code: "demo_already_used" },
            { status: 409 },
          );
        }
      }

      const version = await createSongVersion(enrichedOrder, FREE_DEMO.seconds, "דמו");
      const response: OrderResponse = {
        orderId: `demo_${Date.now()}`,
        mode: "demo",
        promptPreview: version.promptPreview,
        versions: [version],
      };

      if (!admin) {
        await supabase.from("free_demo_usage").insert({ user_id: user.id });
      }

      return NextResponse.json(response);
    }

    // mode === "full"
    const idempotencyKey = (order.idempotencyKey || "").trim();

    if (!admin && !idempotencyKey) {
      return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
    }

    const orderId = randomUUID();
    const songSeconds = SONG_LENGTH_OPTIONS.some((option) => option.seconds === order.songLengthSeconds)
      ? (order.songLengthSeconds as number)
      : MAX_VERSION_SECONDS;

    if (!admin) {
      const { error: spendError } = await supabase.rpc("spend_credits", {
        p_user_id: user.id,
        p_amount: CREDITS_PER_SONG,
        p_reason: "song_production",
        p_order_id: orderId,
        p_note: "יצירת שיר מלא",
        p_idempotency_key: idempotencyKey,
      });

      if (spendError) {
        if (spendError.message.includes("insufficient_credits")) {
          return NextResponse.json(
            { error: "חסרים לך קרדיטים להפקת השיר", code: "insufficient_credits", required: CREDITS_PER_SONG },
            { status: 402 },
          );
        }

        throw spendError;
      }
    }

    const versions: GeneratedVersion[] = [];

    try {
      versions.push(await createSongVersion(enrichedOrder, songSeconds, "א"));
      versions.push(await createSongVersion(enrichedOrder, songSeconds, "ב"));
    } catch (generationError) {
      if (!admin) {
        await supabase.rpc("grant_credits", {
          p_user_id: user.id,
          p_amount: CREDITS_PER_SONG,
          p_reason: "refund",
          p_note: "החזר בעקבות תקלה בהפקת השיר",
          p_expires_at: null,
          p_idempotency_key: `refund_${idempotencyKey}`,
        });
      }

      if (generationError instanceof MusicProviderError) {
        return NextResponse.json(
          { error: "תקלה זמנית בהפקת השיר — הקרדיטים הוחזרו לחשבון שלך. אפשר לנסות שוב.", refunded: true },
          { status: 502 },
        );
      }

      throw generationError;
    }

    const uploadedPaths = await Promise.all(
      versions.map((version) =>
        version.audioDataUrl && version.audioContentType
          ? uploadSongAudio(supabase, user.id, orderId, version.label, version.audioDataUrl, version.audioContentType)
          : Promise.resolve(null),
      ),
    );

    const promptPreview = versions[0]?.promptPreview || "";
    const { error: insertError } = await supabase
      .from("orders")
      .insert(
        orderInsertRow(orderId, user.id, enrichedOrder, "full", promptPreview, songSeconds, admin ? 0 : CREDITS_PER_SONG),
      );

    if (insertError) {
      console.error("Failed to persist order:", insertError.message);
    }

    const { error: versionsError } = await supabase.from("song_versions").insert(
      versions.map((version, index) => ({
        order_id: orderId,
        version_label: version.label,
        audio_url: uploadedPaths[index],
        credits_cost: 0,
      })),
    );

    if (versionsError) {
      console.error("Failed to persist song versions:", versionsError.message);
    }

    return NextResponse.json({
      orderId,
      mode: "full",
      promptPreview,
      versions,
    } satisfies OrderResponse);
  } catch (error) {
    if (error instanceof MusicProviderError) {
      return NextResponse.json(
        {
          error: error.message,
          providerStatus: error.providerStatus,
          providerMessage: error.providerMessage,
        },
        { status: 502 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        error: "Order request failed before the music provider returned a response",
        message,
      },
      { status: 500 },
    );
  }
}
