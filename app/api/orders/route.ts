import { NextRequest, NextResponse } from "next/server";

type OrderPayload = {
  songType?: string;
  recipient?: string;
  occasion?: string;
  style?: string;
  mood?: string;
  vocalist?: string;
  languageRegister?: string;
  lyricStructure?: string;
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
  "languageRegister",
  "lyricStructure",
  "story",
  "customerName",
  "email",
  "phone",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

const songTypeDirections: Record<string, string> = {
  gift:
    "Personal gift song. Warm, specific, emotional without being sentimental or embarrassing. Address the subject naturally in second person when it fits.",
  business:
    "Short brand song or jingle. Clear hook, polished commercial Hebrew, memorable phrase, no hard-sell cliches, suitable for a social video.",
  graduation:
    "End-of-year or graduation song. Inclusive plural Hebrew, celebratory and nostalgic, easy for a group to sing along to.",
};

const styleDirections: Record<string, string> = {
  "פופ ישראלי עכשווי ונקי":
    "Contemporary Israeli pop, warm piano/guitar, light electronic drums, polished radio feel, 92-108 BPM.",
  "בלדה ישראלית מרגשת":
    "Emotional Israeli ballad, piano and acoustic guitar, gradual lift, intimate vocal, 72-86 BPM.",
  "ים תיכוני עדין ומכובד":
    "Gentle Mediterranean Israeli style, darbuka touches, oud or nylon guitar, tasteful and not caricatured, 96-112 BPM.",
  "אקוסטי חם ומשפחתי":
    "Warm acoustic arrangement, nylon guitar, soft percussion, close vocal, natural family-event feeling, 82-98 BPM.",
  "היפ הופ ישראלי קליל":
    "Light Israeli hip hop/pop rap, conversational Hebrew flow, clean beat, catchy sung hook, 88-100 BPM.",
  "ג'ינגל קצר לעסק":
    "Compact advertising jingle, immediate melodic hook, clear brand name, bright instruments, 110-128 BPM.",
};

const moodDirections: Record<string, string> = {
  "מרגש אבל לא כבד": "moving and sincere, but not sad or heavy",
  "שמח וקופצני": "happy, energetic, danceable, with a smile in the vocal delivery",
  "מצחיק ואישי": "playful, personal, witty, but never mocking or childish",
  "יוקרתי ונקי": "premium, restrained, elegant, clear diction, no noisy production",
  "נוסטלגי וחם": "nostalgic, warm, memory-driven, with a sense of shared history",
  "מתוק לילדים": "sweet, simple, child-friendly, clear words, no baby talk",
};

const vocalistDirections: Record<string, string> = {
  "זמרת ישראלית חמה": "female Israeli vocalist, warm clear diction, natural Hebrew phrasing",
  "זמר ישראלי חם": "male Israeli vocalist, warm clear diction, natural Hebrew phrasing",
  "דואט גבר ואישה": "male and female duet, gentle harmonies, clear call-and-response moments",
  "קולות קבוצה": "small group vocals in the chorus, singalong feeling, clear lead vocal in verses",
  "קול צעיר ונקי": "young clean vocal, bright and friendly, suitable for school or birthday",
  "קול בוגר ומכובד": "mature respectful vocal, calm and confident, suitable for family or business",
};

const languageDirections: Record<string, string> = {
  "עברית ישראלית מדוברת":
    "Use natural modern Israeli Hebrew, like people actually speak in Israel. Avoid translationese and overly formal wording.",
  "עברית חגיגית ונקייה":
    "Use polished festive Hebrew that still sounds singable and contemporary. Avoid biblical stiffness.",
  "עברית קלילה עם סלנג עדין":
    "Use light everyday Hebrew with only gentle slang where it feels natural. Do not overdo slang.",
  "עברית לילדים":
    "Use simple, clear Hebrew that children can sing. Short sentences, concrete images, no babyish wording.",
};

const lyricStructureDirections: Record<string, string> = {
  "בית קצר ופזמון קליט":
    "20-second structure: two short verse lines, then a four-line chorus with one repeated hook.",
  "פזמון פתיחה ישר לעניין":
    "20-second structure: start immediately with the hook, then add two personal detail lines, then repeat the hook.",
  "ג'ינגל עם סלוגן":
    "20-second structure: brand/subject name in the first line, benefit or emotion in the second, slogan twice as the hook.",
  "ברכה אישית מרגשת":
    "20-second structure: one intimate opening line, two concrete memories/details, one heartfelt wish as the hook.",
};

function directionFor(map: Record<string, string>, value: unknown) {
  const key = text(value);

  return map[key] || key || "not specified";
}

function buildMusicPrompt(order: OrderPayload) {
  const structure = directionFor(lyricStructureDirections, order.lyricStructure);
  const lines = [
    "Create a 20-second original song with Hebrew lyrics for a paying customer.",
    "The Hebrew is the highest priority: write idiomatic modern Israeli Hebrew, not translated English. Use correct right-to-left Hebrew words only, no transliteration, no niqqud, no English lyric fragments unless the customer explicitly provided them.",
    "Make the lyrics singable: short lines, clear stresses, natural word order, no forced rhymes, no awkward gender shifts, no inflated phrases like generic AI poetry.",
    "Use concrete personal details from the customer story. Prefer simple emotional images over abstract compliments.",
    "Because the output is 20 seconds, keep the song compact and complete. Do not create a long intro.",
    `Song type direction: ${directionFor(songTypeDirections, order.songType)}`,
    `Subject: ${text(order.recipient)}`,
    `Occasion or campaign goal: ${text(order.occasion)}`,
    `Music style direction: ${directionFor(styleDirections, order.style)}`,
    `Mood direction: ${directionFor(moodDirections, order.mood)}`,
    `Vocal direction: ${directionFor(vocalistDirections, order.vocalist)}`,
    `Hebrew register: ${directionFor(languageDirections, order.languageRegister)}`,
    `Lyric structure: ${structure}`,
    `Customer story: ${text(order.story)}`,
    `Must include: ${text(order.mustInclude) || "none"}`,
    `Avoid: ${text(order.avoid) || "none"}`,
    "Final safety rule: write original lyrics and melody only. Do not imitate a named artist, existing song, protected voice, melody, or copyrighted lyrics.",
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
