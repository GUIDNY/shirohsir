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
  recipientGender?: "male" | "female";
  // Customer-supplied finished lyrics, used verbatim instead of writing
  // lyrics from `story` — see getHebrewLyrics().
  customLyrics?: string;
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

// A full set of song lyrics runs longer than the general free-text cap
// above (multiple verses + chorus repeats for a 3-minute song) — capped
// separately so a customer's own finished lyrics don't get cut short.
export function customLyricsText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 3000) : "";
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
  "קול חם המתאים לרגע":
    "warm, natural, contemporary Israeli vocal tone — gender and character chosen to fit the emotional context, not specified by the customer",
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

// Used for longer songs (see buildHebrewLyrics) to give the second verse
// its own line instead of just repeating the first — pulled from the
// customer's own story text when there's more than one sentence there,
// otherwise a generic (gender-neutral, no ambiguous ־ך suffix) filler.
function secondSentence(value: unknown) {
  const clean = text(value).replace(/\s+/g, " ");
  const sentences = clean
    .split(/[.!?。!?\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidate = sentences[1];

  if (!candidate || /[A-Za-z]/.test(candidate) || candidate.split(/\s+/).some((word) => word.length > 10)) {
    return "";
  }

  return line(candidate);
}

function storyLyricLine(order: OrderContent) {
  const story = text(order.story);
  const occasion = text(order.occasion);
  const source = `${story} ${occasion}`;
  const isFemale = order.recipientGender === "female";

  if (/סקי|שלג|גולש|גולשים|חורף|עונה/i.test(source)) {
    return "השלג כבר קורא, וכולם מוכנים";
  }

  if (/משפחה|חברים|חברות|אוהב|אוהבת|אהבה/i.test(source)) {
    // "אותך" (you, object form) is spelled identically for both genders —
    // niqqud alone can't disambiguate it, so this uses the "עליך/עלייך"
    // preposition family instead, which does differ in spelling.
    return isFemale ? "כל האהבה הזאת מרחפת עלייך" : "כל האהבה הזאת מרחפת עליך";
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

  if (/משפחה/i.test(occasion)) {
    return "המשפחה שלנו ביחד";
  }

  if (/חבר/i.test(occasion)) {
    return "החברות הזאת שווה הכל";
  }

  if (/פרידה/i.test(occasion)) {
    return "הדרך ממשיכה מכאן";
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

// ---- heuristic inference (replaces the old style/mood/vocalist/language/
// structure dropdowns) ----------------------------------------------------
//
// The customer only picks an occasion chip + up to 2 "how should it feel"
// mood chips, and tells the story in free text. Everything below turns
// those into the same five internal attributes buildHebrewLyrics() and
// createSongVersion() already know how to use — so the generation pipeline
// itself is unchanged, only where its inputs come from.

export type StoryInput = {
  songType?: string;
  occasion?: string;
  moods?: string[];
  inspiration?: string;
};

export type InferredAttributes = {
  style: string;
  mood: string;
  vocalist: string;
  languageRegister: string;
  lyricStructure: string;
};

const MOOD_CHIP_DIRECTIONS: Record<string, string> = {
  מרגש: "moving and sincere, warm emotional delivery",
  מצחיק: "playful, witty, light-hearted, fun energy",
  רומנטי: "romantic, tender, intimate love-song feeling",
  שמח: "happy, upbeat, celebratory energy",
  קצבי: "rhythmic, danceable, driving groove",
};

function combineMoodDirection(moods: string[] | undefined): string {
  const picked = (moods ?? []).filter((mood) => MOOD_CHIP_DIRECTIONS[mood]);

  if (picked.length === 0) {
    return moodDirections["מרגש אבל לא כבד"];
  }

  return picked.map((mood) => MOOD_CHIP_DIRECTIONS[mood]).join(", combined with ");
}

function inferStyle(occasion: string, moods: string[], songType: string | undefined): string {
  if (songType === "business") {
    return "ג'ינגל קצר לעסק";
  }

  if (/חתונה|אהבה|זוגיות/.test(occasion) || moods.includes("רומנטי")) {
    return "ים תיכוני עדין ומכובד";
  }

  if (/פרידה/.test(occasion)) {
    return "בלדה ישראלית מרגשת";
  }

  if (/משפחה/.test(occasion)) {
    return "אקוסטי חם ומשפחתי";
  }

  if (moods.includes("קצבי")) {
    return "היפ הופ ישראלי קליל";
  }

  return "פופ ישראלי עכשווי ונקי";
}

function inferLanguageRegister(occasion: string): string {
  if (/חתונה|עסק/.test(occasion)) {
    return "עברית חגיגית ונקייה";
  }

  return "עברית ישראלית מדוברת";
}

function inferLyricStructure(occasion: string, songType: string | undefined): string {
  if (songType === "graduation" || /פרידה|חבר/.test(occasion)) {
    return "ברכה אישית מרגשת";
  }

  if (/עסק/.test(occasion) && songType !== "business") {
    return "פזמון פתיחה ישר לעניין";
  }

  return "בית קצר ופזמון קליט";
}

export function inferSongAttributes(input: StoryInput): InferredAttributes {
  const occasion = text(input.occasion);
  const moods = input.moods ?? [];

  return {
    style: inferStyle(occasion, moods, input.songType),
    mood: combineMoodDirection(moods),
    vocalist: "קול חם המתאים לרגע",
    languageRegister: inferLanguageRegister(occasion),
    lyricStructure: inferLyricStructure(occasion, input.songType),
  };
}

// Every 2nd-person reference below uses the "עליך/עלייך"-family of
// prepositions (which differ in spelling by gender — an extra י for
// feminine) instead of plain ־ך-suffixed forms like לך/איתך/שלך/אותך,
// which are spelled identically for both genders and can't be fixed
// by niqqud alone (see order.recipientGender — there's no reliable way
// for the downstream Nakdan diacritization call to guess gender from
// an ambiguous consonant spelling, so the disambiguation has to happen
// here, in the template text itself).
// A short template (one verse + one chorus/hook) reads as a full song
// around 20-60 seconds, but the customer can pick up to 3 minutes
// (SONG_LENGTH_OPTIONS) — without more structure, ElevenLabs has to
// stretch that same handful of lines across the whole requested
// duration through repetition/instrumental padding. Past ~60s this
// appends a second verse + chorus repeat, and past ~140s a bridge +
// final chorus, so longer songs actually have a longer written song
// instead of just a longer instrumental fade.
function extendForLength(
  core: string[],
  repeatBlock: string[],
  songSeconds: number,
  elaboration: string,
  bridge: string,
) {
  const lines = [...core];

  if (songSeconds > 60) {
    lines.push("[Verse]", elaboration, ...repeatBlock);
  }

  if (songSeconds > 140) {
    lines.push("[Bridge]", bridge, ...repeatBlock);
  }

  return lines.join("\n");
}

export function buildHebrewLyrics(order: OrderContent, songSeconds = 20) {
  const subject = subjectForLyrics(order);
  const hook = occasionHook(order);
  const detail = storyLyricLine(order);
  const include = mustIncludeLine(order);
  const isFemale = order.recipientGender === "female";
  const elaboration = secondSentence(order.story) || "הרגעים האלה נשארים בלב לתמיד";
  const bridge = "עוד שיר, עוד רגע, עוד סיבה לחייך";

  if (order.songType === "business") {
    const hookBlock = ["[Hook]", `${subject}, ${hook}`, include || "קל לזכור, נעים לשמוע"];

    return extendForLength([...hookBlock, "[Verse]", `${detail}`, ...hookBlock], hookBlock, songSeconds, elaboration, bridge);
  }

  if (order.songType === "graduation") {
    const chorusBlock = ["[Chorus]", include || "כל צעד קטן הפך לזיכרון", "שרים בקול, עם לב גדול", `${subject}, היום הזה שלנו`];

    return extendForLength(
      ["[Verse]", `${hook}, כולנו כאן ביחד`, `${detail}`, ...chorusBlock],
      chorusBlock,
      songSeconds,
      elaboration,
      bridge,
    );
  }

  if (order.lyricStructure === "פזמון פתיחה ישר לעניין") {
    const chorusBlock = ["[Chorus]", `${hook} ${subject}`, include || (isFemale ? "הלב שלנו שר אלייך" : "הלב שלנו שר אליך")];

    return extendForLength([...chorusBlock, "[Verse]", `${detail}`, ...chorusBlock], chorusBlock, songSeconds, elaboration, bridge);
  }

  if (order.lyricStructure === "ברכה אישית מרגשת") {
    const chorusBlock = [
      "[Chorus]",
      include || (isFemale ? "שיאיר עלייך אור בכל הדרך" : "שיאיר עליך אור בכל הדרך"),
      `${hook} מכל הלב`,
      isFemale ? "השיר הזה שר אלייך" : "השיר הזה שר אליך",
    ];

    return extendForLength(
      [
        "[Verse]",
        isFemale ? `${subject}, היום חושבים עלייך` : `${subject}, היום חושבים עליך`,
        `${detail}`,
        ...chorusBlock,
      ],
      chorusBlock,
      songSeconds,
      elaboration,
      bridge,
    );
  }

  const chorusBlock = [
    "[Chorus]",
    include || `${hook}, שרים מכל הלב`,
    "רגע קטן הופך לשיר",
    isFemale ? `${subject}, תמיד תזכרי את היום הזה` : `${subject}, תמיד תזכור את היום הזה`,
  ];

  return extendForLength(
    ["[Verse]", isFemale ? `${subject}, היום הזה זורח עלייך` : `${subject}, היום הזה זורח עליך`, `${detail}`, ...chorusBlock],
    chorusBlock,
    songSeconds,
    elaboration,
    bridge,
  );
}

const GEMINI_MODEL = process.env.GEMINI_MODEL_ID || "gemini-2.5-flash";

// ־ך-suffixed 2nd-person words whose consonants are identical for
// masculine/feminine (only niqqud differs) — the prompt below tells
// Gemini to avoid these, but LLM instruction-following isn't
// guaranteed. Rather than reject any response that slips one in
// (which turned out to reject nearly every response — these are
// extremely common, natural words), addNiqqud() forces the correct
// gendered niqqud for exactly these words via Nakdan's own per-word
// tokenization, using order.recipientGender instead of trusting
// Nakdan's own (unreliable, context-based) guess.
const GENDERED_NIQQUD_OVERRIDES: Record<string, { male: string; female: string }> = {
  לך: { male: "לְךָ", female: "לָךְ" },
  אותך: { male: "אוֹתְךָ", female: "אוֹתָךְ" },
  שלך: { male: "שֶׁלְּךָ", female: "שֶׁלָּךְ" },
  איתך: { male: "אִתְּךָ", female: "אִתָּךְ" },
  אתך: { male: "אִתְּךָ", female: "אִתָּךְ" },
  בשבילך: { male: "בִּשְׁבִילְךָ", female: "בִּשְׁבִילֵךְ" },
  אצלך: { male: "אֶצְלְךָ", female: "אֶצְלֵךְ" },
  בזכותך: { male: "בִּזְכוּתְךָ", female: "בִּזְכוּתֵךְ" },
  בגללך: { male: "בִּגְלָלְךָ", female: "בִּגְלָלֵךְ" },
  כמוך: { male: "כָּמוֹךָ", female: "כָּמוֹךְ" },
  ממך: { male: "מִמְּךָ", female: "מִמֵּךְ" },
  עצמך: { male: "עַצְמְךָ", female: "עַצְמֵךְ" },
  סביבך: { male: "סְבִיבְךָ", female: "סְבִיבֵךְ" },
  מסביבך: { male: "מִסְּבִיבְךָ", female: "מִסְּבִיבֵךְ" },
  לצדך: { male: "לְצִדְּךָ", female: "לְצִדֵּךְ" },
  ולצדך: { male: "וּלְצִדְּךָ", female: "וּלְצִדֵּךְ" },
  בעבורך: { male: "בַּעֲבוּרְךָ", female: "בַּעֲבוּרֵךְ" },
  תוכך: { male: "תּוֹכְךָ", female: "תּוֹכֵךְ" },
  בתוכך: { male: "בְּתוֹכְךָ", female: "בְּתוֹכֵךְ" },
  בלעדיך: { male: "בִּלְעָדֶיךָ", female: "בִּלְעָדַיִךְ" },
  לפניך: { male: "לְפָנֶיךָ", female: "לְפָנַיִךְ" },
  אחריך: { male: "אַחֲרֶיךָ", female: "אַחֲרַיִךְ" },
};

function geminiApiKey() {
  return cleanApiKey(process.env.GEMINI_API_KEY);
}

function lyricsStructureHint(songSeconds: number) {
  if (songSeconds > 140) {
    return '6 קטעים בסה"כ: [Verse] ואז [Chorus], אחר כך [Verse] שני ואז [Chorus] שוב, ולבסוף [Bridge] קצר ו-[Chorus] אחרון.';
  }

  if (songSeconds > 60) {
    return '4 קטעים בסה"כ: [Verse] ואז [Chorus], ואז [Verse] שני נוסף ו-[Chorus] שוב.';
  }

  return '2 קטעים בלבד: [Verse] קצר אחד ו-[Chorus] קצר אחד.';
}

// Calls Gemini for real (non-templated) Hebrew lyrics. Returns null on
// any failure — missing key, provider error, timeout, or a response
// that doesn't look like structured lyrics — so the caller can fall
// back to buildHebrewLyrics() rather than ever surfacing a broken or
// empty result to the customer.
async function generateLyricsWithGemini(order: OrderContent, songSeconds: number): Promise<string | null> {
  const apiKey = geminiApiKey();

  if (!apiKey) {
    return null;
  }

  const isFemale = order.recipientGender === "female";
  const prompt = [
    "כתוב מילים לשיר פופ אישי בעברית, מבוסס על הפרטים הבאים:",
    `- מוקדש ל: ${text(order.pronunciation) || text(order.recipient) || "האדם המיוחד הזה"}`,
    `- אירוע: ${text(order.occasion) || "רגע מיוחד"}`,
    `- סיפור/פרטים אישיים לשלב בשיר: ${text(order.story) || "אין פרטים נוספים, תשתמש באווירה כללית של האירוע"}`,
    text(order.mustInclude) ? `- חובה לשלב בצורה טבעית בתוך המילים: ${text(order.mustInclude)}` : "",
    text(order.avoid) ? `- אסור בשום אופן להזכיר או לרמוז על: ${text(order.avoid)}` : "",
    isFemale ? "- פנייה בלשון נקבה לאורך כל השיר, מההתחלה ועד הסוף כולל הברידג'." : "- פנייה בלשון זכר לאורך כל השיר.",
    "- חשוב מאוד, בלי שום יוצא מן הכלל: אסור להשתמש במילים המסתיימות ב-ך שכתיבן זהה לזכר ולנקבה — למשל לך, אותך, שלך, איתך, בשבילך, אצלך, מולך, בזכותך, בגללך, כמוך, ממך, לפניך, אחריך. במקום זה תמיד תשתמש בניסוחים חד-משמעיים כמו 'עלייך/עליך', 'אלייך/אליך', בשם עצמו (למשל 'נועה' במקום 'לך'), או בגוף שלישי.",
    `- מבנה נדרש: ${lyricsStructureHint(songSeconds)}`,
    "- הבתים (Verse) חייבים להתבסס על פרטים קונקרטיים ומדויקים מהסיפור שסופק — שמות, מקומות, פעולות, בדיחות פנימיות — ולא על תיאור כללי שיכול להתאים לכל אדם. אם הסיפור מכיל יותר מפרט אחד, פזר אותם בין הבתים השונים במקום לחזור על אותו פרט.",
    "- אסור להשתמש בביטויים שחוקים כמו 'מכל הלב', 'רגע קטן הופך לשיר', 'שרים בקול', 'עם לב גדול', 'איזה יום מיוחד' — אלה נשמעים גנריים מדי. תמצא ניסוח מקורי ומפתיע יותר, ספציפי לאדם ולסיפור הזה.",
    "- עברית ישראלית טבעית ומודרנית, קלילה לשירה, חרוזים כשמתאפשר בטבעיות. בלי מילים באנגלית ובלי גיבריש.",
    "- סמן כל קטע עם תגית בשורה נפרדת: [Verse] / [Chorus] / [Bridge].",
    "- החזר אך ורק את מילות השיר עם התגיות שלהן — בלי כותרת, בלי הסברים, בלי מירכאות.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // "Thinking" mode roughly quadruples latency (~13s vs ~3.5s in
          // testing) for no measurable quality gain on a short lyric-writing
          // task — disabled so the preview step stays responsive.
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!response.ok) {
      console.error(`[GEMINI_LYRICS_FALLBACK] http ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) {
      console.error("[GEMINI_LYRICS_FALLBACK] empty response");
      return null;
    }

    const cleaned = raw.trim();

    // Sanity-check the shape rather than trusting the model blindly —
    // catches refusals, empty completions, or missing structure tags.
    if (!/\[Verse\]/i.test(cleaned) || !/\[Chorus\]/i.test(cleaned) || cleaned.length < 20 || cleaned.length > 2000) {
      console.error("[GEMINI_LYRICS_FALLBACK] malformed response shape");
      return null;
    }

    return cleaned;
  } catch (err) {
    console.error("[GEMINI_LYRICS_FALLBACK] request failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// Single entry point every caller should use to get lyrics text: real
// AI-written lyrics from Gemini when GEMINI_API_KEY is configured and
// the call succeeds, otherwise the deterministic template — so the
// order flow degrades gracefully instead of ever failing outright
// because of the AI provider.
export async function getHebrewLyrics(order: OrderContent, songSeconds = 20): Promise<string> {
  const customLyrics = customLyricsText(order.customLyrics);

  if (customLyrics) {
    return customLyrics;
  }

  const aiLyrics = await generateLyricsWithGemini(order, songSeconds);

  return aiLyrics ?? buildHebrewLyrics(order, songSeconds);
}

type NakdanToken = {
  nakdan?: { options?: Array<{ w?: string }>; sep?: boolean };
  str?: string;
};

async function addNiqqudToLine(line: string, isFemale: boolean): Promise<string> {
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
      .map((token) => {
        const override = token.str ? GENDERED_NIQQUD_OVERRIDES[token.str.trim()] : undefined;

        if (override) {
          return isFemale ? override.female : override.male;
        }

        return token.nakdan?.options?.[0]?.w || token.str || "";
      })
      .join("")
      .replace(/\|/g, "");
  } catch {
    // Diacritization is a quality nice-to-have, not required — never let a
    // slow/unreachable Nakdan API block or break song generation.
    return line;
  }
}

export async function addNiqqud(lyrics: string, isFemale = false): Promise<string> {
  const lines = lyrics.split("\n");
  const vocalized = await Promise.all(lines.map((line) => addNiqqudToLine(line, isFemale)));

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

function elevenLabsApiKey() {
  return cleanApiKey(
    process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVEN_API_KEY ||
      process.env.EVEANLABS_API_KEY ||
      process.env.API_KEY ||
      process.env.XI_API_KEY,
  );
}

export type ElevenLabsSubscription = {
  tier?: string;
  character_count?: number;
  character_limit?: number;
  max_credit_limit_extension?: number | "unlimited";
  can_extend_character_limit?: boolean;
  current_overage?: { amount_cents?: number; currency?: string };
  status?: string;
  has_open_invoices?: boolean;
  next_character_count_reset_unix?: number | null;
  currency?: string | null;
  billing_period?: string | null;
};

export type ElevenLabsQuota =
  | { ok: true; subscription: ElevenLabsSubscription; remaining: number; limit: number }
  | { ok: false; reason: "missing_api_key" | "provider_error"; providerStatus?: number; detail?: string };

// Shared by the admin quota panel (/api/credits) and the pre-generation
// check in /api/orders — one fetch of ElevenLabs' account-wide quota;
// each caller reads whatever fields it needs from `subscription`.
// "remaining"/"limit" are in ElevenLabs' own character-based unit (the
// same figure the account dashboard shows) — we don't have a verified
// characters-per-second conversion for Music generation, so the
// pre-generation check only guards against the account being fully
// exhausted (remaining <= 0) rather than pretending to size each
// request precisely.
export async function fetchElevenLabsQuota(): Promise<ElevenLabsQuota> {
  const apiKey = elevenLabsApiKey();

  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const providerResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!providerResponse.ok) {
    const providerMessage = await providerResponse.text();
    return {
      ok: false,
      reason: "provider_error",
      providerStatus: providerResponse.status,
      detail: providerMessage.slice(0, 300),
    };
  }

  const subscription = (await providerResponse.json()) as ElevenLabsSubscription;
  const used = typeof subscription.character_count === "number" ? subscription.character_count : 0;
  const limit = typeof subscription.character_limit === "number" ? subscription.character_limit : 0;

  return { ok: true, subscription, remaining: Math.max(limit - used, 0), limit };
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
  const apiKey = elevenLabsApiKey();
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const apiUrl =
    process.env.ELEVENLABS_MUSIC_API_URL ||
    `https://api.elevenlabs.io/v1/music/stream?output_format=${encodeURIComponent(outputFormat)}`;
  const musicLengthMs = songSeconds * 1000;
  const modelId = process.env.ELEVENLABS_MUSIC_MODEL_ID || "music_v2";
  const lyrics = await getHebrewLyrics(order, songSeconds);
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
  const vocalizedLyrics = await addNiqqud(lyrics, order.recipientGender === "female");

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
