import {
  allPricingPlans,
  CREDITS_PER_SONG,
  EXTRA_VERSION_CREDITS,
  FREE_DEMO,
  MAX_VERSION_SECONDS,
  PricingPlan,
  SONG_LENGTH_OPTIONS,
  SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
} from "@/lib/pricing-catalog";
import { SITE_NAME, SITE_NAME_HE, SITE_URL, SOCIAL_PROFILE_URLS, SUPPORT_EMAIL } from "@/lib/site-config";

// /llms.txt (https://llmstxt.org) — a plain-markdown briefing for AI
// assistants and answer engines: what Shirli is, how it works, the real
// prices and the key pages. Prerendered at build time from
// lib/pricing-catalog.ts + lib/site-config.ts, so its numbers can never
// drift from the site. Same facts as the homepage copy, /faq and the
// legal pages — nothing here should promise more than they do.
export const dynamic = "force-static";

function planLine(plan: PricingPlan) {
  const kind = plan.isSubscription ? "מנוי חודשי" : "רכישה חד-פעמית";
  const price = plan.isSubscription ? `${plan.priceIls} ₪ לחודש` : `${plan.priceIls} ₪`;
  const credits = plan.isSubscription ? `${plan.credits} קרדיטים בכל חודש` : `${plan.credits} קרדיטים`;
  const average = plan.perSongAveragePriceIls ? `, מחיר ממוצע לשיר: ${plan.perSongAveragePriceIls} ₪` : "";

  return `- ${plan.name} (${kind}): ${price} — ${credits}, מספיק עבור ${plan.sufficientForText}${average}.`;
}

function buildLlmsTxt() {
  const maxMinutes = MAX_VERSION_SECONDS / 60;
  const songLengths = SONG_LENGTH_OPTIONS.map((option) => option.label).join(" / ");

  return [
    `# ${SITE_NAME} (${SITE_NAME_HE})`,
    "",
    `> ${SITE_NAME_HE} (${SITE_NAME}) היא מערכת אוטומטית שהופכת סיפור אישי לשיר מקורי בעברית: מספרים על האדם, האירוע והרגעים החשובים, והמערכת כותבת, מלחינה ומפיקה שיר מוכן להורדה ולשיתוף תוך דקות. ${SITE_NAME} is a fully automated service that turns your story into an original, personalized song in Hebrew within minutes, ready to download and share.`,
    "",
    "## About",
    "",
    `- ${SITE_NAME} (${SITE_NAME_HE}) היא אפליקציה מבוססת קרדיטים ליצירת שירים אישיים בעברית: ${SITE_URL}/`,
    "- התהליך אוטומטי לחלוטין — מרגע ההזמנה ועד ההורדה, ללא מגע אנושי. השירים מופקים באמצעות ElevenLabs Music.",
    `- כל שיר מלא כולל שתי גרסאות מוזיקליות שונות. משך השיר לבחירה: ${songLengths}.`,
    "- השירים נשמרים באזור האישי באתר — להאזנה, להורדה ולשיתוף (גם כגלויה מוזיקלית עם תמונה וקישור אישי).",
    "- סוגי שירים: שיר מתנה (יום הולדת, זוגיות, חתונה, גיוס, הפתעה מרגשת), שיר לעסק (פרסום, אירוע, קמפיין, פתיח, תוכן לרשתות) ושיר למסיבה או אירוע (גן, בית ספר, צוות, מסיבת סיום, חגיגה משפחתית).",
    `- ממשק האתר בעברית; עמוד הסבר באנגלית: ${SITE_URL}/en`,
    "",
    "## How it works",
    "",
    "1. בוחרים סוג שיר — יום הולדת, חתונה, זוגיות, עסק או כל אירוע אחר.",
    "2. מספרים את הסיפור — שמות, זיכרונות, בדיחות ורגעים מיוחדים. מי שכבר כתב מילים מדביק אותן, והשיר מופק בדיוק לפיהן.",
    "3. מאשרים את המילים — המערכת מציגה סיכום של מה שהבינה ואת מילות השיר לפני ההפקה, ואפשר לחזור ולשנות.",
    "4. מורידים את השיר — המערכת כותבת, מלחינה ומפיקה אותו אוטומטית תוך דקות, ושתי הגרסאות זמינות באזור האישי.",
    "",
    "- אפשר לבחור אווירה (מרגש, מצחיק, רומנטי, שמח, קצבי) ולציין זמר או סגנון כהשראה כללית — לא כשכפול של שיר קיים.",
    "- אפשר להקליט או להעלות קטע קצר (זמזום, שירה, נגינה) כהשראה לאווירה, לקצב ולסגנון — לא כשכפול מדויק של הלחן.",
    `- דמו חינם: משתמש חדש יכול ליצור, לאחר הרשמה, דמו אישי אחד באורך ${FREE_DEMO.seconds} שניות — ללא תשלום, ללא התחייבות וללא כרטיס אשראי (להאזנה באתר בלבד).`,
    "",
    "## Pricing",
    "",
    "- כל המחירים בשקלים (ILS, ₪). התשלום מעובד על ידי Lemon Squeezy (Merchant of Record).",
    `- שיר מלא = ${CREDITS_PER_SONG} קרדיטים (שתי גרסאות, עד ${maxMinutes} דקות כל אחת). גרסה נוספת לשיר קיים = ${EXTRA_VERSION_CREDITS} קרדיטים.`,
    ...allPricingPlans.filter((plan) => plan.isActive).map(planLine),
    `- קרדיטים מרכישה חד-פעמית אינם פוקעים; קרדיטים ממנוי תקפים ל-${SUBSCRIPTION_CREDIT_VALIDITY_DAYS} יום. מנוי מתחדש אוטומטית מדי חודש, ואפשר לבטל בכל עת.`,
    `- החזרים: החזר מלא על קרדיטים שלא נוצלו בתוך 14 יום מהרכישה; קרדיטים שנוצלו אינם ניתנים להחזר; בתקלה טכנית הקרדיטים מוחזרים אוטומטית. פרטים: ${SITE_URL}/refund-policy`,
    "",
    "## What you can and can't create",
    "",
    "- אפשר: סיפור אישי עם שמות, זיכרונות, בדיחות ורגעים מיוחדים; סגנון מוזיקלי לבחירה (שמח, מרגש, קצבי, רגוע או חגיגי); מילים משלכם; ותיקונים במילים לפני ההפקה.",
    "- אי אפשר: העתקה של שירים קיימים (מילים או מנגינה של שיר מוגן); חיקוי מדויק של קול של אדם אמיתי; תוכן פוגעני או ללא הסכמה (משמיץ, מטריד, מיני, אלים, גזעני או בלתי חוקי).",
    "- אין הבטחה שהשיר יצליח מסחרית, יתפרסם או יניב הכנסות.",
    `- זכויות: לפי תנאי השימוש, השיר ניתן ללקוח ברישיון עולמי, קבוע ובלתי בלעדי, לשימוש אישי ומסחרי; אין הבטחה לבלעדיות מוחלטת. פרטים: ${SITE_URL}/terms`,
    "",
    "## Key pages",
    "",
    `- [עמוד הבית](${SITE_URL}/): יצירת שיר אישי — הסבר, דמו חינם וטופס ההזמנה.`,
    `- [מחירים](${SITE_URL}/pricing): שיר בודד, חבילות שירים ומנויים חודשיים.`,
    `- [שאלות נפוצות](${SITE_URL}/faq): התהליך, זמנים, מחירים, קרדיטים, זכויות שימוש והחזרים.`,
    `- [English overview](${SITE_URL}/en): English explainer — how it works and pricing.`,
    `- [תנאי שימוש](${SITE_URL}/terms): קרדיטים, שימוש מותר ואסור, רישיון השימוש בשיר ותשלומים (עברית + English).`,
    `- [מדיניות פרטיות](${SITE_URL}/privacy): אילו נתונים נאספים, ספקי משנה וזכויות המשתמש (עברית + English).`,
    `- [מדיניות החזרים](${SITE_URL}/refund-policy): החזר על קרדיטים, תקלות טכניות וביטול מנוי (עברית + English).`,
    "",
    "## Contact",
    "",
    `- אימייל: ${SUPPORT_EMAIL}`,
    `- אתר: ${SITE_URL}/`,
    ...SOCIAL_PROFILE_URLS.map((url) => `- ${url}`),
    "",
  ].join("\n");
}

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
