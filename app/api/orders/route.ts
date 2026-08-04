import { NextRequest, NextResponse } from "next/server";

type OrderPayload = {
  songType?: string;
  recipient?: string;
  occasion?: string;
  style?: string;
  mood?: string;
  vocalist?: string;
  story?: string;
  mustInclude?: string;
  avoid?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
};

type OrderResponse = {
  orderId: string;
  provider: string;
  status: string;
  mode: "demo" | "live";
  promptPreview: string;
  audioDataUrl?: string;
  audioContentType?: string;
  downloadFileName?: string;
};

class MusicProviderError extends Error {
  constructor(
    public providerStatus: number,
    public providerMessage: string,
  ) {
    super("ElevenLabs music request failed");
  }
}

const requiredFields: Array<keyof OrderPayload> = [
  "recipient",
  "occasion",
  "style",
  "mood",
  "vocalist",
  "story",
  "customerName",
  "email",
  "phone",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function buildMusicPrompt(order: OrderPayload) {
  const lines = [
    "Create an original Hebrew song in Hebrew for a paying customer.",
    "Use natural Hebrew lyrics with correct right-to-left wording. Do not transliterate Hebrew into English.",
    "Make the song complete, catchy, emotionally clear, and suitable for delivery to a customer.",
    `Song type: ${text(order.songType)}`,
    `Subject: ${text(order.recipient)}`,
    `Occasion or campaign goal: ${text(order.occasion)}`,
    `Music style: ${text(order.style)}`,
    `Mood: ${text(order.mood)}`,
    `Vocal direction: ${text(order.vocalist)}`,
    `Customer story: ${text(order.story)}`,
    `Must include: ${text(order.mustInclude) || "none"}`,
    `Avoid: ${text(order.avoid) || "none"}`,
    "Important: write original lyrics only. Do not imitate a named artist, existing song, protected voice, melody, or copyrighted lyrics.",
  ];

  return lines.join("\n");
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

function contentTypeForOutputFormat(outputFormat: string) {
  if (outputFormat.startsWith("wav")) {
    return "audio/wav";
  }

  if (outputFormat.startsWith("pcm")) {
    return "audio/wav";
  }

  return "audio/mpeg";
}

function cleanApiKey(value: string | undefined) {
  if (!value) {
    return "";
  }

  const withoutEnvName = value.replace(/^\s*(?:ELEVENLABS_API_KEY|ELEVEN_API_KEY|EVEANLABS_API_KEY|API_KEY|XI_API_KEY)\s*=\s*/i, "");
  const withoutWrappingQuotes = withoutEnvName.trim().replace(/^["']|["']$/g, "");

  return withoutWrappingQuotes.replace(/[^\x20-\x7e]/g, "");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "custom-song"
  );
}

async function createElevenLabsSong(prompt: string, order: OrderPayload): Promise<OrderResponse> {
  const apiKey = cleanApiKey(
    process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVEN_API_KEY ||
      process.env.EVEANLABS_API_KEY ||
      process.env.API_KEY ||
      process.env.XI_API_KEY,
  );
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const apiUrl =
    process.env.ELEVENLABS_MUSIC_API_URL ||
    `https://api.elevenlabs.io/v1/music/stream?output_format=${encodeURIComponent(outputFormat)}`;
  const musicLengthMs = envNumber("ELEVENLABS_MUSIC_LENGTH_MS", 20000, 3000, 600000);
  const modelId = process.env.ELEVENLABS_MUSIC_MODEL_ID || "music_v1";

  if (!apiKey) {
    return {
      orderId: `demo_${Date.now()}`,
      provider: "elevenlabs-demo",
      status: "missing_elevenlabs_api_key",
      mode: "demo",
      promptPreview: prompt.slice(0, 420),
    };
  }

  const providerResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: musicLengthMs,
      model_id: modelId,
      force_instrumental: false,
    }),
  });

  if (!providerResponse.ok) {
    const providerError = await providerResponse.text();

    throw new MusicProviderError(providerResponse.status, providerError.slice(0, 500));
  }

  const audioBuffer = await providerResponse.arrayBuffer();
  const audioContentType =
    providerResponse.headers.get("content-type") || contentTypeForOutputFormat(outputFormat);
  const songId = providerResponse.headers.get("song-id");
  const base64 = arrayBufferToBase64(audioBuffer);

  return {
    orderId: songId || `eleven_${Date.now()}`,
    provider: "elevenlabs",
    status: "audio_ready",
    mode: "live",
    promptPreview: prompt.slice(0, 420),
    audioDataUrl: `data:${audioContentType};base64,${base64}`,
    audioContentType,
    downloadFileName: `${safeFileName(text(order.recipient))}.mp3`,
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

  const prompt = buildMusicPrompt(order);
  try {
    const response = await createElevenLabsSong(prompt, order);

    return NextResponse.json(response);
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
