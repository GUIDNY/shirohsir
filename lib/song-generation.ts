// Shared Hebrew lyric-writing + ElevenLabs music generation used by
// every route that produces song audio: /api/orders (demo + full),
// /api/orders/[id]/extra-version, /api/orders/[id]/revise. Kept in one
// place so none of those routes duplicate the style/mood/vocalist
// direction maps or the provider call itself.

export type OrderContent = {
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
};

export type GeneratedVersion = {
  label: string;
  provider: string;
  status: string;
  mode: "demo" | "live";
  promptPreview: string;
  audioDataUrl?: string;
  audioContentType?: string;
  downloadFileName?: string;
};

export class MusicProviderError extends Error {
  constructor(
    public providerStatus: number,
    public providerMessage: string,
  ) {
    super("ElevenLabs music request failed");
  }
}

export function text(value: unknown) {
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
  const [sentence] = clean.split(/[.!?。!?\n]/);

  return line(sentence, "יש סיפור קטן שכולם זוכרים");
}

function storyLyricLine(order: OrderContent) {
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

function subjectForLyrics(order: OrderContent) {
  const pronunciation = text(order.pronunciation);

  return line(pronunciation || text(order.recipient), "השמחה הזאת");
}

function occasionHook(order: OrderContent) {
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

function mustIncludeLine(order: OrderContent) {
  const include = text(order.mustInclude);

  if (!include) {
    return "";
  }

  if (/פותחים עונה/i.test(include) && /משרד|משרדים/i.test(include)) {
    return "פותחים עונה עם כל הצוותים";
  }

  return line(include);
}

export function buildHebrewLyrics(order: OrderContent) {
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

type NakdanToken = {
  nakdan?: { options?: Array<{ w?: string }>; sep?: boolean };
  str?: string;
};

async function addNiqqudToLine(line: string): Promise<string> {
  const trimmed = line.trim();

  // Structure tags like [Verse]/[Chorus]/[Hook] are ElevenLabs formatting,
  // not Hebrew lyrics — leave them untouched.
  if (!trimmed || /^\[[^\]]+\]$/.test(trimmed) || !/[א-ת]/.test(trimmed)) {
    return line;
  }

  try {
    const response = await fetch("https://nakdan-u1-0.loadbalancer.dicta.org.il/api", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        task: "nakdan",
        genre: "modern",
        data: line,
        addmorph: false,
        keepqq: false,
        nodageshdefmem: false,
        patachma: false,
        keepmetagim: false,
        useTokenization: true,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return line;
    }

    const payload = (await response.json()) as { data?: NakdanToken[] };

    if (!payload.data || payload.data.length === 0) {
      return line;
    }

    return payload.data
      .map((token) => token.nakdan?.options?.[0]?.w || token.str || "")
      .join("")
      .replace(/\|/g, "");
  } catch {
    // Diacritization is a quality nice-to-have, not required — never let a
    // slow/unreachable Nakdan API block or break song generation.
    return line;
  }
}

async function addNiqqud(lyrics: string): Promise<string> {
  const lines = lyrics.split("\n");
  const vocalized = await Promise.all(lines.map((line) => addNiqqudToLine(line)));

  return vocalized.join("\n");
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

export async function createSongVersion(order: OrderContent, songSeconds: number, versionLabel: string): Promise<GeneratedVersion> {
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
  const musicLengthMs = songSeconds * 1000;
  const modelId = process.env.ELEVENLABS_MUSIC_MODEL_ID || "music_v2";
  const lyrics = buildHebrewLyrics(order);
  const positiveStyles = [
    directionFor(styleDirections, order.style),
    directionFor(moodDirections, order.mood),
    directionFor(vocalistDirections, order.vocalist),
    directionFor(languageDirections, order.languageRegister),
    "clear modern Israeli Hebrew pronunciation",
    "short singable Hebrew lines",
    songSeconds <= 20 ? "compact 20 second song with immediate vocals" : "full arrangement with intro, verse, chorus and outro",
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
      label: versionLabel,
      provider: "elevenlabs-demo",
      status: "missing_elevenlabs_api_key",
      mode: "demo",
      promptPreview: lyrics.slice(0, 420),
    };
  }

  // Hebrew without niqqud is genuinely ambiguous for a singing model — the
  // same letters can be several different words depending on the vowels.
  // Dicta's Nakdan (a free, established Hebrew diacritization service) adds
  // niqqud before we hand the lyrics to ElevenLabs. Falls back to the plain
  // text line-by-line on any failure, so a slow/unreachable Nakdan never
  // blocks or breaks song generation.
  const vocalizedLyrics = await addNiqqud(lyrics);

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
            text: vocalizedLyrics,
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
  void songId;

  return {
    label: versionLabel,
    provider: "elevenlabs",
    status: "audio_ready",
    mode: "live",
    promptPreview: vocalizedLyrics.slice(0, 420),
    audioDataUrl: `data:${audioContentType};base64,${base64}`,
    audioContentType,
    downloadFileName: `${safeFileName(text(order.recipient))}-${versionLabel}.mp3`,
  };
}

export async function uploadSongAudio(
  supabase: { storage: { from: (bucket: string) => { upload: (path: string, body: Buffer, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }> } } },
  userId: string,
  orderId: string,
  versionLabel: string,
  audioDataUrl: string,
  contentType: string,
): Promise<string | null> {
  try {
    const base64 = audioDataUrl.split(",")[1];

    if (!base64) {
      return null;
    }

    const bytes = Buffer.from(base64, "base64");
    const extension = contentType.includes("wav") ? "wav" : "mp3";
    const path = `${userId}/${orderId}-${versionLabel}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from("songs").upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("Failed to upload song audio:", error.message);
      return null;
    }

    return path;
  } catch (error) {
    console.error("Failed to upload song audio:", error instanceof Error ? error.message : error);
    return null;
  }
}
