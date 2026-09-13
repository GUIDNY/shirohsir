import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { MAX_VERSION_SECONDS, SONG_LENGTH_OPTIONS } from "@/lib/pricing-catalog";
import {
  addNiqqud,
  customLyricsText,
  getLyrics,
  inferSongAttributes,
  inferSongAttributesEn,
  OrderContent,
  text,
} from "@/lib/song-generation";

type PreviewPayload = OrderContent & {
  moods?: string[];
  inspiration?: string;
  songLengthSeconds?: number;
};

// Lets the customer see the actual lyrics before committing to the paid
// step that spends credits and calls ElevenLabs — getHebrewLyrics() is
// the exact same call the real order makes (AI-written via Gemini when
// configured, template fallback otherwise), so this preview always
// matches what the real order will produce for the same inputs.
export async function POST(request: NextRequest) {
  const order = (await request.json()) as PreviewPayload;

  if (!text(order.recipient) || !text(order.occasion) || (!text(order.story) && !customLyricsText(order.customLyrics))) {
    return NextResponse.json({ error: "חסרים פרטים בטופס" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "צריך להתחבר לפני יצירת שיר" }, { status: 401 });
  }

  const isEnglish = order.language === "en";
  const inferred = (isEnglish ? inferSongAttributesEn : inferSongAttributes)({
    songType: order.songType,
    occasion: order.occasion,
    moods: order.moods,
    inspiration: order.inspiration,
  });

  const enrichedOrder: OrderContent = {
    ...order,
    ...inferred,
    recipientGender: order.recipientGender === "female" ? "female" : "male",
  };

  const songSeconds = SONG_LENGTH_OPTIONS.some((option) => option.seconds === order.songLengthSeconds)
    ? (order.songLengthSeconds as number)
    : MAX_VERSION_SECONDS;

  const rawLyrics = await getLyrics(enrichedOrder, songSeconds);
  const lyrics = isEnglish ? rawLyrics : await addNiqqud(rawLyrics, enrichedOrder.recipientGender === "female");

  return NextResponse.json({ lyrics });
}
