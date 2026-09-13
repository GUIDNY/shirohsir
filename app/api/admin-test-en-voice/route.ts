import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";

// TEMPORARY diagnostic route — validates whether ElevenLabs Music v2 can
// actually sing intelligible English before any English-flow code is built
// on top of that assumption. Admin-only. Delete after validation.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY || "";

  if (!apiKey) {
    return NextResponse.json({ error: "missing_elevenlabs_api_key" }, { status: 500 });
  }

  const lyrics = `[Verse]
That scruffy dog Biscuit, a blur of white fur,
Heard he's making off with every sock, what a stir!
And you've been clocking miles since the first days of spring,
On winding trails, where the mountain birds sing.
Training hard, for that big marathon in October.

[Chorus]
So happy birthday, Jake, with your new loyal friend,
And the strength you've built that seems to never end.
Every adventure you chase, every goal you pursue,
Here's to another year that's shining bright for you.
May your journey be joyful, clear, and true.`;

  const positiveStyles = [
    "warm contemporary American pop, acoustic guitar and light percussion",
    "upbeat, celebratory birthday feel",
    "clear, natural American English pronunciation, fully intelligible sung lyrics",
    "short, singable English lines",
    "full arrangement with intro, verse, chorus and outro",
  ];

  const negativeStyles = [
    "Hebrew lyrics",
    "gibberish or nonsense English",
    "fake or made-up words",
    "mixed languages",
    "heavy accent obscuring the words",
    "overly dramatic AI poetry",
    "imitating a known artist",
    "long instrumental intro",
  ];

  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const apiUrl =
    process.env.ELEVENLABS_MUSIC_API_URL ||
    `https://api.elevenlabs.io/v1/music/stream?output_format=${encodeURIComponent(outputFormat)}`;
  const modelId = process.env.ELEVENLABS_MUSIC_MODEL_ID || "music_v2";

  const providerResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      composition_plan: {
        chunks: [
          {
            text: lyrics,
            duration_ms: 35000,
            positive_styles: positiveStyles,
            negative_styles: negativeStyles,
            context_adherence: "high",
          },
        ],
      },
      model_id: modelId,
    }),
  });

  if (!providerResponse.ok) {
    const errorBody = await providerResponse.text();
    return NextResponse.json(
      { error: "elevenlabs_failed", status: providerResponse.status, body: errorBody.slice(0, 2000) },
      { status: 502 },
    );
  }

  const audioBuffer = await providerResponse.arrayBuffer();

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}
