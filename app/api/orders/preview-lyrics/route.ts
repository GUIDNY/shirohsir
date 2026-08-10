import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { MAX_VERSION_SECONDS, SONG_LENGTH_OPTIONS } from "@/lib/pricing-catalog";
import { addNiqqud, buildHebrewLyrics, inferSongAttributes, OrderContent, text } from "@/lib/song-generation";

type PreviewPayload = OrderContent & {
  moods?: string[];
  inspiration?: string;
  songLengthSeconds?: number;
};

// Lets the customer see the actual lyrics before committing to the paid
// step that spends credits and calls ElevenLabs — buildHebrewLyrics() is a
// pure template function of the order fields (not an LLM call), so this
// preview costs nothing and always matches what the real order will
// produce for the same inputs.
export async function POST(request: NextRequest) {
  const order = (await request.json()) as PreviewPayload;

  if (!text(order.recipient) || !text(order.occasion) || !text(order.story)) {
    return NextResponse.json({ error: "חסרים פרטים בטופס" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "צריך להתחבר לפני יצירת שיר" }, { status: 401 });
  }

  const inferred = inferSongAttributes({
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

  const lyrics = await addNiqqud(buildHebrewLyrics(enrichedOrder, songSeconds));

  return NextResponse.json({ lyrics });
}
