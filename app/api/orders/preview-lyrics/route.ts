import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { addNiqqud, buildHebrewLyrics, inferSongAttributes, OrderContent, text } from "@/lib/song-generation";

type PreviewPayload = OrderContent & {
  moods?: string[];
  inspiration?: string;
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

  const lyrics = await addNiqqud(buildHebrewLyrics(enrichedOrder));

  return NextResponse.json({ lyrics });
}
