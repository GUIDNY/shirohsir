import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { createServerClient } from "@/lib/supabase-server";

const ORDER_CREDITS_COST = 1;

type OrderPayload = {
  songType?: string;
  recipient?: string;
  occasion?: string;
  style?: string;
  mood?: string;
  vocalist?: string;
  languageRegister?: string;
  lyricStructure?: string;
  pronunciation?: string;
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

function directionFor(map: Record<string, string>, value: unknown) {
  const key = text(value);

  return map[key] || key || "not specified";
}

function line(value: string, fallback = "") {
  return (value || fallback).replace(/\s+/g, " ").trim().slice(0, 58);
}

function firstSentence(value: unknown) {
  const clean = text(value).replace(/\s+/g, " ");
  const [sentence] = clean.split(/[.!?。！？\n]/);

  return line(sentence, "יש סיפור קטן שכולם זוכרים");
}

function storyLyricLine(order: OrderPayload) {
  const story = text(order.story);
  const occasion = text(order.occasion);
  const source = `${story} ${occasion}`;

  if (/סקי|שלג|גולש|גולשים|חורף|עונה/i.test(source)) {
    return "השלג כבר קורא, וכולם מוכנים";
  }

  if (/משפחה|חברים|חברות|אוהב|אוהבת|אהבה/i.test(source)) {
    return "עם כל האנשים שאוהבים אותך";
  }

  if (/עסק|מותג|לקוח|לקוחות|קמפיין|פרסום|משרד|משרדים/i.test(source)) {
    return "המסר כבר ברור, הקצב באוויר";
  }

  if (/סיום|שנה|כיתה|שכבה|גן|בית ספר|טקס/i.test(source)) {
    return "צעד אחר צעד גדלנו ביחד";
  }

  const raw = firstSentence(story);

  if (/[A-Za-z]/.test(raw) || raw.split(/\s+/).some((word) => word.length > 10)) {
    return "הרגע הזה נשאר איתנו בלב";
  }

  return raw;
}

function subjectForLyrics(order: OrderPayload) {
  const pronunciation = text(order.pronunciation);

  return line(pronunciation || text(order.recipient), "השמחה הזאת");
}

function occasionHook(order: OrderPayload) {
  const occasion = text(order.occasion);

  if (/סקי|שלג|חורף|גולש|גולשים/i.test(occasion)) {
    return "העונה מתחילה";
  }

  if (/יום הולדת|הולדת|birthday/i.test(occasion)) {
    return "מזל טוב";
  }

  if (/חתונ|אהבה|זוג/i.test(occasion)) {
    return "לחיי האהבה";
  }

  if (/סיום|שנה|טקס|בית ספר|גן/i.test(occasion)) {
    return "איזו שנה יפה";
  }

  if (/עסק|מותג|קמפיין|פרסום|ג'ינגל|ג׳ינגל|גינגל/i.test(occasion)) {
    return "זה השם שנשאר";
  }

  return line(occasion, "הרגע הזה");
}

function mustIncludeLine(order: OrderPayload) {
  const include = text(order.mustInclude);

  if (!include) {
    return "";
  }

  if (/פותחים עונה/i.test(include) && /משרד|משרדים/i.test(include)) {
    return "פותחים עונה עם כל הצוותים";
  }

  return line(include);
}

function buildHebrewLyrics(order: OrderPayload) {
  const subject = subjectForLyrics(order);
  const hook = occasionHook(order);
  const detail = storyLyricLine(order);
  const include = mustIncludeLine(order);

  if (order.songType === "business") {
    return [
      "[Hook]",
      `${subject}, ${hook}`,
      include || "קל לזכור, נעים לשמוע",
      "[Verse]",
      `${detail}`,
      "[Hook]",
      `${subject}, ${hook}`,
    ].join("\n");
  }

  if (order.songType === "graduation") {
    return [
      "[Verse]",
      `${hook}, כולנו כאן ביחד`,
      `${detail}`,
      "[Chorus]",
      include || "כל צעד קטן הפך לזיכרון",
      "שרים בקול, עם לב גדול",
      `${subject}, היום הזה שלנו`,
    ].join("\n");
  }

  if (order.lyricStructure === "פזמון פתיחה ישר לעניין") {
    return [
      "[Chorus]",
      `${hook} ${subject}`,
      include || "הלב שלנו שר אליך",
      "[Verse]",
      `${detail}`,
      "[Chorus]",
      `${hook} ${subject}`,
    ].join("\n");
  }

  if (order.lyricStructure === "ברכה אישית מרגשת") {
    return [
      "[Verse]",
      `${subject}, היום חושבים עליך`,
      `${detail}`,
      "[Chorus]",
      include || "שיהיה לך אור בכל הדרך",
      `${hook} מכל הלב`,
      "אנחנו כאן איתך",
    ].join("\n");
  }

  return [
    "[Verse]",
    `${subject}, היום הזה כולו שלך`,
    `${detail}`,
    "[Chorus]",
    include || `${hook}, שרים מכל הלב`,
    "רגע קטן הופך לשיר",
    `${subject}, האור שלך נשאר איתנו`,
  ].join("\n");
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

async function createElevenLabsSong(order: OrderPayload): Promise<OrderResponse> {
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
  const modelId = process.env.ELEVENLABS_MUSIC_MODEL_ID || "music_v2";
  const lyrics = buildHebrewLyrics(order);
  const positiveStyles = [
    directionFor(styleDirections, order.style),
    directionFor(moodDirections, order.mood),
    directionFor(vocalistDirections, order.vocalist),
    directionFor(languageDirections, order.languageRegister),
    "clear modern Israeli Hebrew pronunciation",
    "short singable Hebrew lines",
    "compact 20 second song with immediate vocals",
  ];
  const negativeStyles = [
    "gibberish Hebrew",
    "transliterated Hebrew",
    "English lyrics",
    "fake Hebrew words",
    "overly dramatic AI poetry",
    "imitating a known artist",
    "long instrumental intro",
  ];

  if (!apiKey) {
    return {
      orderId: `demo_${Date.now()}`,
      provider: "elevenlabs-demo",
      status: "missing_elevenlabs_api_key",
      mode: "demo",
      promptPreview: lyrics.slice(0, 420),
    };
  }

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
            duration_ms: musicLengthMs,
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
    promptPreview: lyrics.slice(0, 420),
    audioDataUrl: `data:${audioContentType};base64,${base64}`,
    audioContentType,
    downloadFileName: `${safeFileName(text(order.recipient))}.mp3`,
  };
}

async function persistOrder(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  order: OrderPayload,
  response: OrderResponse,
) {
  const { error } = await supabase.from("orders").insert({
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
    status: response.audioDataUrl ? "delivered" : "lyrics_ready",
    provider: response.provider,
    provider_order_id: response.orderId,
    prompt_preview: response.promptPreview,
    credits_cost: ORDER_CREDITS_COST,
  });

  if (error) {
    console.error("Failed to persist order:", error.message);
  }
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
  const supabase = user ? createServerClient() : null;

  try {
    if (user && supabase) {
      const { error: spendError } = await supabase.rpc("spend_credits", {
        p_user_id: user.id,
        p_amount: ORDER_CREDITS_COST,
        p_reason: "order_spend",
      });

      if (spendError) {
        if (spendError.message.includes("insufficient_credits")) {
          return NextResponse.json(
            { error: "אין מספיק קרדיטים ליצירת שיר נוסף", code: "insufficient_credits" },
            { status: 402 },
          );
        }

        throw spendError;
      }
    }

    let response: OrderResponse;

    try {
      response = await createElevenLabsSong(order);
    } catch (generationError) {
      if (user && supabase) {
        // Generation failed after the credit was already spent — refund it.
        await supabase.rpc("spend_credits", {
          p_user_id: user.id,
          p_amount: -ORDER_CREDITS_COST,
          p_reason: "refund",
          p_note: "generation failed",
        });
      }

      throw generationError;
    }

    if (user && supabase) {
      await persistOrder(supabase, user.id, order, response);
    }

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
