import type { Metadata } from "next";
import { Fragment } from "react";
import { JsonLd } from "../JsonLd";
import { LegalPageShell } from "../LegalPageShell";
import {
  creditPacks,
  CREDITS_PER_SONG,
  EXTRA_VERSION_CREDITS,
  FREE_DEMO,
  singleSongPlan,
  SONG_LENGTH_OPTIONS,
  SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
  subscriptionPlans,
} from "@/lib/pricing-catalog";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site-config";
import { WEBSITE_ID } from "@/lib/structured-data";

const title = "שאלות נפוצות | Shirli";
const description =
  "תשובות לשאלות נפוצות על שירלי: איך יוצרים שיר אישי בעברית, תוך כמה זמן הוא מוכן, כמה זה עולה, דמו חינם, קרדיטים, זכויות שימוש והחזרים.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title,
    description,
    url: "/faq",
    siteName: SITE_NAME,
    locale: "he_IL",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

// One entry = one visible Q&A below AND one Question in the FAQPage
// JSON-LD, so the structured data can never drift from the page. Every
// answer only restates what the site already says (homepage copy,
// lib/pricing-catalog.ts, /terms, /refund-policy) — nothing new is
// promised here — and every price/credit/length/expiry number comes
// straight from the catalog. The refund-window numbers (14 days, 5–10
// business days) mirror app/refund-policy/page.tsx; keep them in sync.
type FaqItem = {
  question: string;
  answer: string;
  list?: string[];
  link?: { href: string; label: string };
};

// "א, ב או ג"
function joinWithOr(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} או ${items[items.length - 1]}` : items.join("");
}

const songLengthsText = joinWithOr(SONG_LENGTH_OPTIONS.map((option) => option.label));

const priceList = [
  ...creditPacks
    .filter((pack) => pack.isActive)
    .map((pack) => {
      const average = pack.perSongAveragePriceIls ? ` (מחיר ממוצע לשיר: ${pack.perSongAveragePriceIls} ₪)` : "";

      return `${pack.name}: ${pack.priceIls} ₪ — ${pack.credits} קרדיטים${average}.`;
    }),
  ...subscriptionPlans
    .filter((plan) => plan.isActive)
    .map(
      (plan) =>
        `${plan.name}: ${plan.priceIls} ₪ לחודש — ${plan.credits} קרדיטים בכל חודש (${plan.sufficientForText}).`,
    ),
];

const faqItems: FaqItem[] = [
  {
    question: "מה זה שירלי (Shirli)?",
    answer:
      "שירלי (Shirli) היא מערכת אוטומטית ליצירת שירים אישיים בעברית. מספרים למערכת על האדם, האירוע והרגעים החשובים — והיא כותבת, מלחינה ומפיקה שיר מקורי, מוכן להורדה ולשיתוף. התהליך אוטומטי לחלוטין, מרגע ההזמנה ועד ההורדה, ללא מגע אנושי, והשירים מופקים באמצעות ElevenLabs Music.",
  },
  {
    question: "איך זה עובד, וכמה זמן זה לוקח?",
    answer:
      "ממלאים כמה פרטים, מאשרים את המילים לפני ההפקה ומקבלים שיר מוכן להורדה ולשיתוף — המערכת כותבת, מלחינה ומפיקה אותו אוטומטית תוך דקות. התהליך כולל ארבעה שלבים:",
    list: [
      "1. בוחרים סוג שיר — יום הולדת, חתונה, זוגיות, עסק או כל אירוע אחר.",
      "2. מספרים את הסיפור — שמות, זיכרונות, בדיחות ורגעים מיוחדים.",
      "3. מאשרים את המילים — עוברים על מה שהמערכת הבינה ומאשרים לפני ההפקה.",
      "4. מורידים את השיר — הגרסאות המוכנות זמינות באזור האישי להורדה ולשיתוף.",
    ],
    link: { href: "/#order", label: "מתחילים ליצור שיר" },
  },
  {
    question: "מה מקבלים בסוף?",
    answer: `כל שיר מלא כולל שתי גרסאות מוזיקליות שונות, כדי שתוכלו לבחור את זו שאתם הכי אוהבים. את משך השיר בוחרים מראש: ${songLengthsText}. השירים נשמרים באזור האישי, ומשם אפשר להאזין להם, להוריד את קובצי השמע ולשתף — גם כגלויה מוזיקלית עם תמונה וקישור אישי.`,
  },
  {
    question: "אפשר לשמוע דמו לפני שמשלמים?",
    answer: `כן. כל משתמש חדש יכול ליצור, לאחר הרשמה לאתר, דמו אישי אחד באורך ${FREE_DEMO.seconds} שניות — ללא תשלום, ללא התחייבות וללא כרטיס אשראי. הדמו מיועד להאזנה באתר בלבד, ואם אהבתם את הכיוון אפשר להמשיך משם להפקת השיר המלא.`,
    link: { href: "/#demo", label: "ליצירת דמו חינם" },
  },
  {
    question: "כמה עולה שיר אישי?",
    answer: `שיר אישי בודד עולה ${singleSongPlan.priceIls} ₪ וכולל ${singleSongPlan.credits} קרדיטים — מספיק עבור ${singleSongPlan.sufficientForText}. כל המחירים בשקלים, והתשלום מתבצע באמצעות Lemon Squeezy. למי שמתכנן יותר משיר אחד יש גם חבילות שירים ומנויים חודשיים (מנוי מתחדש אוטומטית מדי חודש, ואפשר לבטל אותו בכל עת):`,
    list: priceList,
    link: { href: "/pricing", label: "לכל המסלולים בעמוד המחירים" },
  },
  {
    question: "מה הם קרדיטים, והאם הם פוקעים?",
    answer: `קרדיטים הם יחידת גישה מראש לשימוש במערכת: שיר מלא עולה ${CREDITS_PER_SONG} קרדיטים וכולל שתי גרסאות, וגרסה נוספת לשיר קיים עולה ${EXTRA_VERSION_CREDITS} קרדיטים. קרדיטים מרכישה חד-פעמית (שיר בודד או חבילה) אינם פוקעים, וקרדיטים שמתקבלים במסגרת מנוי תקפים ל-${SUBSCRIPTION_CREDIT_VALIDITY_DAYS} יום. הקרדיטים אינם כסף, אינם ניתנים להמרה למזומן ואינם ניתנים להעברה בין חשבונות.`,
  },
  {
    question: "אפשר לראות ולשנות את המילים לפני ההפקה?",
    answer:
      "כן. לפני שהשיר מופק, המערכת מציגה סיכום קצר של מה שהבינה ואת מילות השיר. אפשר לאשר, או לחזור, לשנות פרטים ולבקש התאמות — הקרדיטים מנוצלים רק בשלב האחרון, כשמאשרים ושולחים את השיר להפקה. גם השינויים מבוצעים אוטומטית, ללא עריכה אנושית.",
  },
  {
    question: "אפשר להביא מילים משלי או הקלטה להשראה?",
    answer:
      "כן. אם כבר כתבתם מילים, מדביקים אותן והשיר מופק בדיוק לפיהן, בלי לשנות אותן. אפשר גם להקליט או להעלות קטע קצר — זמזום, שירה, נגינה או כל רעיון מוזיקלי — ושירלי תשתמש בו כהשראה לאווירה, לקצב ולסגנון של השיר. חשוב לדעת: זה לא שכפול מדויק של הלחן, ויש לאשר שההקלטה שלכם או שיש לכם הרשאה להשתמש בה.",
  },
  {
    question: "באילו סגנונות מוזיקליים אפשר ליצור?",
    answer:
      "בוחרים איך השיר ירגיש — מרגש, מצחיק, רומנטי, שמח או קצבי — ואפשר גם לציין זמר, שיר או סגנון שאתם אוהבים (למשל פופ ישראלי) כהשראה כללית. ההשראה היא לסגנון בלבד: לא שכפול של שיר קיים ולא חיקוי מדויק של קול של אדם אמיתי.",
  },
  {
    question: "לאילו אירועים מתאים שיר אישי?",
    answer:
      'אפשר ליצור שיר מתנה — ליום הולדת, זוגיות, חתונה, גיוס או הפתעה מרגשת; שיר לעסק — לפרסום, אירוע, קמפיין, פתיח או תוכן לרשתות; ושיר למסיבה או אירוע — לגן, בית ספר, צוות, מסיבת סיום או חגיגה משפחתית. אם האירוע שלכם לא ברשימה, בוחרים "אחר" ומתארים אותו.',
  },
  {
    question: "מה לא ניתן ליצור?",
    answer: "כמה דברים חשובים שלא ניתן לבקש:",
    list: [
      "העתקה של שירים קיימים — לא ניתן להשתמש במילים או במנגינה של שיר מוגן.",
      "חיקוי מדויק של זמר — אפשר לבחור סגנון כללי, אך לא לחקות באופן מדויק קול של אדם אמיתי.",
      "תוכן פוגעני או ללא הסכמה — לא ניתן ליצור תוכן שמבזה אדם אחר או משתמש בפרטיו באופן לא ראוי, וגם לא תוכן משמיץ, מטריד, מיני, אלים, גזעני או בלתי חוקי.",
      "הבטחת הצלחה מסחרית — לא ניתן להבטיח ששיר יצליח, יתפרסם או יניב הכנסות.",
    ],
  },
  {
    question: "למי שייכות הזכויות בשיר, ואיך מותר להשתמש בו?",
    answer:
      "לפי תנאי השימוש, השיר שנוצר עבורכם ניתן לכם ברישיון עולמי, קבוע ובלתי בלעדי, לשימוש אישי ומסחרי כאחד — כולל שיתוף, פרסום ומכירה של תוצרים המבוססים על השיר. המערכת, הטכנולוגיה והקוד נשארים בבעלותנו, ואין הבטחה לבלעדיות מוחלטת: תהליך יצירה דומה עשוי להניב תוצרים בעלי דמיון עבור משתמשים אחרים.",
    link: { href: "/terms", label: "לתנאי השימוש המלאים" },
  },
  {
    question: "אפשר לקבל החזר כספי או לבטל מנוי?",
    answer: "בקצרה, לפי מדיניות ההחזרים:",
    list: [
      `קרדיטים שלא נוצלו — אפשר לבקש החזר מלא בתוך 14 יום ממועד הרכישה, בפנייה ל-${SUPPORT_EMAIL}.`,
      "קרדיטים שנוצלו — קרדיטים ששימשו ליצירת שיר (שיר מלא, גרסה נוספת או שינוי) אינם ניתנים להחזר.",
      "תקלה טכנית — אם הפקת שיר נכשלה עקב תקלה במערכת, הקרדיטים מוחזרים לחשבון אוטומטית, ללא צורך בפנייה.",
      "ביטול מנוי — אפשר לבטל בכל עת מהאזור האישי. הביטול מונע את החיוב הבא; אין זיכוי יחסי על התקופה ששולמה, והקרדיטים שכבר התקבלו נשארים זמינים עד לתאריך התפוגה שלהם.",
      "עיבוד ההחזר — ההחזרים מעובדים על ידי Lemon Squeezy בתוך 5–10 ימי עסקים ממועד האישור.",
    ],
    link: { href: "/refund-policy", label: "למדיניות ההחזרים המלאה" },
  },
  {
    question: "איך יוצרים קשר?",
    answer: "בכל שאלה — על הזמנה, קרדיטים, מנוי או החזר — אפשר לכתוב לנו במייל:",
    link: { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL },
  },
];

// Plain-text answer for the JSON-LD — the same answer, list lines and
// link the page renders (internal links as absolute URLs).
function faqAnswerText(item: FaqItem) {
  const linkText = item.link
    ? item.link.href.startsWith("mailto:")
      ? item.link.label
      : `${item.link.label}: ${SITE_URL}${item.link.href}`
    : null;

  return [item.answer, ...(item.list ?? []), linkText].filter(Boolean).join("\n");
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  name: "שאלות נפוצות",
  url: `${SITE_URL}/faq`,
  inLanguage: "he-IL",
  isPartOf: { "@id": WEBSITE_ID },
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faqAnswerText(item),
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />

      <LegalPageShell titleHe="שאלות נפוצות">
        <p>כל מה שכדאי לדעת על יצירת שיר אישי בעברית עם שירלי — איך זה עובד, כמה זה עולה, מה מקבלים ומה מותר ליצור.</p>

        {faqItems.map((item) => (
          <Fragment key={item.question}>
            <h2>{item.question}</h2>
            <p>{item.answer}</p>
            {item.list && (
              <ul>
                {item.list.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            )}
            {item.link && (
              <p>
                <a href={item.link.href}>{item.link.label}</a>
              </p>
            )}
          </Fragment>
        ))}
      </LegalPageShell>
    </>
  );
}
