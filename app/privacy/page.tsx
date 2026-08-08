import type { Metadata } from "next";
import { LegalPageShell } from "../LegalPageShell";
import { SUPPORT_EMAIL } from "@/lib/site-config";

const title = "מדיניות פרטיות | מנגינה אישית";
const description = "אילו נתונים אוספת מנגינה אישית, מי מעבד אותם, וכיצד לבקש גישה, תיקון או מחיקה.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title,
    description,
    url: "/privacy",
    images: ["/og.png"],
  },
};

const LAST_UPDATED = "2026-08-08";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      titleEn="Privacy Policy"
      titleHe="מדיניות פרטיות"
      englishChildren={
        <>
          <p>Last updated: {LAST_UPDATED}</p>

          <h2>1. What We Collect</h2>
          <ul>
            <li>Your email address (to create and access your account).</li>
            <li>The story text and details you submit to generate a song.</li>
            <li>Your order history and credit usage.</li>
          </ul>
          <p>
            We do not collect or store payment card details. These are collected and stored solely by Lemon
            Squeezy, our payment processor.
          </p>

          <h2>2. Sub-processors</h2>
          <p>To operate the Service, we use the following sub-processors:</p>
          <ul>
            <li><strong>Lemon Squeezy</strong> — payment processing.</li>
            <li><strong>Vercel</strong> — application hosting.</li>
            <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
            <li><strong>ElevenLabs</strong> — automated voice and music generation.</li>
          </ul>

          <h2>3. Important Notice — Third-Party Information</h2>
          <p>
            The story you share may include details about other people (e.g. a name, an event, personal
            characteristics). It is your responsibility to ensure you have appropriate consent to share this
            information, and to avoid sharing particularly sensitive details unless necessary.
          </p>

          <h2>4. Data Retention</h2>
          <p>
            Account information is retained as long as your account is active, until you request deletion. Order
            records (including related billing details) are retained for 7 years in accordance with Israeli tax
            law, even if the account is later deleted.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your data (subject to the retention
            requirement above) by contacting <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>

          <h2>6. Cookies</h2>
          <p>
            We use only essential cookies required to operate the Site (such as maintaining your login session). We
            do not use advertising or marketing-tracking cookies.
          </p>

          <h2>7. Contact</h2>
          <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        </>
      }
    >
      <p>עודכן לאחרונה: {LAST_UPDATED}</p>

      <h2>1. אילו נתונים אנו אוספים</h2>
      <ul>
        <li>כתובת האימייל שלך (לצורך יצירת חשבון והתחברות).</li>
        <li>טקסט הסיפור והפרטים שהזנת ליצירת השיר.</li>
        <li>היסטוריית ההזמנות ושימוש הקרדיטים שלך.</li>
      </ul>
      <p>איננו אוספים או שומרים פרטי כרטיס אשראי — אלה נאספים ומאוחסנים אך ורק על ידי Lemon Squeezy, ספק הסליקה שלנו.</p>

      <h2>2. ספקי משנה (Sub-processors)</h2>
      <p>לצורך הפעלת השירות אנו משתמשים בספקי המשנה הבאים:</p>
      <ul>
        <li><strong>Lemon Squeezy</strong> — עיבוד תשלומים.</li>
        <li><strong>Vercel</strong> — אחסון והרצת האתר.</li>
        <li><strong>Supabase</strong> — בסיס נתונים, אימות משתמשים ואחסון קבצים.</li>
        <li><strong>ElevenLabs</strong> — הפקת קול ומוזיקה אוטומטית.</li>
      </ul>

      <h2>3. אזהרה חשובה — מידע על צדדים שלישיים</h2>
      <p>
        הסיפור שאתה משתף עשוי לכלול פרטים על אנשים אחרים (למשל שם, אירוע, מאפיינים אישיים). באחריותך לוודא שיש לך
        הסכמה מתאימה לשתף מידע זה, ולהימנע משיתוף מידע רגיש במיוחד ללא צורך.
      </p>

      <h2>4. שמירת נתונים</h2>
      <p>
        מידע בחשבון נשמר כל עוד החשבון פעיל, ועד לבקשת מחיקה. רשומות הזמנה (לרבות פרטי חיוב הקשורים) נשמרות למשך 7
        שנים בהתאם לחוקי המס בישראל, גם אם החשבון נמחק בהמשך.
      </p>

      <h2>5. הזכויות שלך</h2>
      <p>
        באפשרותך לבקש גישה למידע שלך, תיקון שלו, או מחיקתו (בכפוף למגבלת שמירת החוק כאמור לעיל), על ידי פנייה
        ל-<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>6. עוגיות (Cookies)</h2>
      <p>
        אנו משתמשים אך ורק בעוגיות חיוניות הנדרשות לתפעול האתר (כגון שמירת session ההתחברות שלך). איננו משתמשים
        בעוגיות פרסום או מעקב שיווקי.
      </p>

      <h2>7. יצירת קשר</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPageShell>
  );
}
