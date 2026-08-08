import type { Metadata } from "next";
import { LegalPageShell } from "../LegalPageShell";
import { CREDITS_PER_SONG } from "@/lib/pricing-catalog";

export const metadata: Metadata = {
  title: "תנאי שימוש | מנגינה אישית",
  description: "תנאי השימוש באפליקציית מנגינה אישית — מערכת SaaS מבוססת קרדיטים ליצירת שירים אישיים אוטומטית.",
};

const LAST_UPDATED = "2026-08-08";

export default function TermsPage() {
  return (
    <LegalPageShell
      titleEn="Terms of Service"
      titleHe="תנאי שימוש"
      englishChildren={
        <>
          <p>Last updated: {LAST_UPDATED}</p>

          <h2>1. Definitions &amp; Scope of Service</h2>
          <p>
            &quot;Personal Melody&quot; (&quot;the Site&quot;, &quot;the System&quot;) is a credit-based SaaS
            application for generating personalized Hebrew songs. Using the Site requires purchasing credits in
            advance, which are used to run a fully automated generation process: you submit a story, the system
            writes the lyrics automatically, you may request a revision (also generated automatically, with no
            human review or editing), and the system produces two audio versions available for download in your
            account area. There is no human involvement in the generation process itself.
          </p>

          <h2>2. Credits</h2>
          <p>
            Credits are a prepaid access unit for use within the System only. Credits are not money, securities,
            digital currency, a deposit, or any other financial instrument; they have no independent cash value
            outside the System; they are not redeemable for cash and are not transferable between accounts.{" "}
            {CREDITS_PER_SONG} credits = one full song, including two audio versions. Credit and package prices
            are listed on the <a href="/pricing">Pricing</a> page and may change from time to time, without
            affecting credits already purchased.
          </p>

          <h2>3. Acceptable Use</h2>
          <p>When using the Site, you agree not to:</p>
          <ul>
            <li>Reproduce, copy, or request a song identical or substantially similar to a third party&apos;s copyrighted song.</li>
            <li>Request an exact imitation of the voice of a real, identifiable person (a singer, public figure, etc.) without their consent.</li>
            <li>Submit defamatory, harassing, sexual, violent, racist, or otherwise unlawful content.</li>
            <li>Use the Service for fraud, impersonation, or to violate another person&apos;s privacy.</li>
          </ul>
          <p>Violating these provisions may result in suspension or termination of your account, with no right to a refund of used credits.</p>

          <h2>4. Ownership &amp; License</h2>
          <p>
            The song generated for you is granted to you under a worldwide, perpetual, non-exclusive license for
            both personal and commercial use (including sharing, publishing, and selling derivative works based on
            the song). The System, technology, design, and underlying code remain our exclusive property. We do
            not guarantee absolute exclusivity of the song — a similar generation process may produce results with
            similarities for other users.
          </p>

          <h2>5. No Guarantee of Outcome</h2>
          <p>
            We make no commitment as to artistic quality, commercial success, publicity, or audience response to
            the song. The Service is provided &quot;AS IS&quot;.
          </p>

          <h2>6. Payments</h2>
          <p>
            All payments on the Site are processed and collected by Lemon Squeezy Inc., which acts as the Merchant
            of Record for all orders. Lemon Squeezy is responsible for tax collection, receipt issuance, and
            compliance with applicable payment regulations. Your payment card details are collected and stored
            solely by Lemon Squeezy — we never see or store them.
          </p>

          <h2>7. Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Israel, and any dispute shall be resolved exclusively in the competent courts of Israel.</p>

          <h2>8. Contact</h2>
          <p>
            For questions about these Terms, contact us at <a href="mailto:bd12123@gmail.com">bd12123@gmail.com</a>.
          </p>
        </>
      }
    >
      <p>עודכן לאחרונה: {LAST_UPDATED}</p>

      <h2>1. הגדרות והיקף השירות</h2>
      <p>
        &quot;מנגינה אישית&quot; (&quot;האתר&quot;, &quot;המערכת&quot;) היא אפליקציית SaaS מבוססת קרדיטים ליצירת שירים
        אישיים בעברית. השימוש באתר כרוך ברכישת קרדיטים מראש, המשמשים להפעלת תהליך יצירה אוטומטי לחלוטין: הזנת
        סיפור, כתיבת מילים אוטומטית על ידי המערכת, אפשרות לבקש שינוי (המיוצר אף הוא אוטומטית, ללא בדיקה או עריכה
        אנושית), והפקת שתי גרסאות אודיו הזמינות להורדה באזור האישי. אין מעורבות אנושית בתהליך היצירה עצמו.
      </p>

      <h2>2. קרדיטים</h2>
      <p>
        קרדיטים הם יחידת גישה מוקדמת (prepaid) לשימוש בשירותי המערכת בלבד. קרדיטים אינם כסף, ניירות ערך, מטבע
        דיגיטלי, פיקדון או כל מכשיר פיננסי אחר; אין להם ערך כספי עצמאי מחוץ למערכת; הם אינם ניתנים להמרה למזומן
        ואינם ניתנים להעברה בין חשבונות. {CREDITS_PER_SONG} קרדיטים = שיר מלא אחד, הכולל שתי גרסאות אודיו. מחירי
        הקרדיטים והחבילות מפורטים בעמוד <a href="/pricing">המחירים</a> ועשויים להתעדכן מעת לעת, ללא פגיעה בקרדיטים
        שכבר נרכשו.
      </p>

      <h2>3. שימוש מותר ואסור</h2>
      <p>בעת שימוש באתר הנך מתחייב/ת שלא:</p>
      <ul>
        <li>לשחזר, להעתיק, או לבקש שיר הזהה או דומה באופן מהותי לשיר מוגן בזכויות יוצרים של צד שלישי.</li>
        <li>לבקש חיקוי מדויק של קולו של אדם אמיתי המזוהה (זמר/ת, איש/ת ציבור וכו&apos;) ללא הסכמתו/ה.</li>
        <li>להזין תוכן משמיץ, מטריד, מיני, אלים, גזעני, או בלתי חוקי בכל דרך אחרת.</li>
        <li>להשתמש בשירות למטרות הונאה, התחזות, או פגיעה בפרטיות של אדם אחר.</li>
      </ul>
      <p>הפרת סעיפים אלה עשויה להוביל להשעיה או סגירה של החשבון, ללא זכות להחזר על קרדיטים שנוצלו.</p>

      <h2>4. בעלות ורישיון שימוש</h2>
      <p>
        השיר שנוצר עבורך ניתן לך ברישיון עולמי, קבוע, בלתי בלעדי, לשימוש אישי ומסחרי כאחד (לרבות שיתוף, פרסום,
        ומכירה של תוצרים המבוססים על השיר). המערכת, הטכנולוגיה, העיצוב והקוד מאחורי האתר נשארים בבעלותנו הבלעדית.
        איננו מבטיחים בלעדיות מוחלטת של השיר — ייתכן שתהליך יצירה דומה יניב תוצרים בעלי דמיון למשתמשים אחרים.
      </p>

      <h2>5. אין הבטחת תוצאה</h2>
      <p>
        איננו מתחייבים לאיכות אמנותית מסוימת, הצלחה מסחרית, פרסום, או תגובת קהל לשיר. השירות ניתן כפי שהוא
        (&quot;AS IS&quot;).
      </p>

      <h2>6. תשלומים</h2>
      <p>
        כל התשלומים באתר מעובדים ונגבים על ידי Lemon Squeezy Inc., המשמשת כ-Merchant of Record עבור כלל ההזמנות.
        Lemon Squeezy אחראית לגביית מס, הפקת קבלות, ועמידה ברגולציית תשלומים רלוונטית. פרטי כרטיס האשראי שלך
        נאספים ומאוחסנים אך ורק על ידי Lemon Squeezy — אנחנו לא רואים ולא שומרים אותם.
      </p>

      <h2>7. דין וסמכות שיפוט</h2>
      <p>תנאים אלה כפופים לדיני מדינת ישראל, וכל סכסוך יידון בבתי המשפט המוסמכים בישראל בלבד.</p>

      <h2>8. יצירת קשר</h2>
      <p>
        לשאלות בנוגע לתנאים אלה, ניתן לפנות אלינו ב-<a href="mailto:bd12123@gmail.com">bd12123@gmail.com</a>.
      </p>
    </LegalPageShell>
  );
}
