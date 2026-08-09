import type { Metadata } from "next";
import { LegalPageShell } from "../LegalPageShell";
import { SUPPORT_EMAIL } from "@/lib/site-config";

const title = "מדיניות החזרים | My Shirli";
const description = "מתי אפשר לקבל החזר על קרדיטים, ומה קורה במקרה של תקלה טכנית או ביטול מנוי.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/refund-policy",
  },
  openGraph: {
    title,
    description,
    url: "/refund-policy",
    images: ["/og.png"],
  },
};

const LAST_UPDATED = "2026-08-08";

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      titleEn="Refund Policy"
      titleHe="מדיניות החזרים"
      englishChildren={
        <>
          <p>Last updated: {LAST_UPDATED}</p>

          <h2>1. Unused Credits</h2>
          <p>
            You may request a full refund for purchased credits that have not been used, within 14 days of
            purchase, by contacting <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>

          <h2>2. Used Credits</h2>
          <p>
            Credits used to generate a song (a full song, an extra version, or a revision) are not refundable —
            the digital product has already been fully delivered.
          </p>

          <h2>3. Technical Failure</h2>
          <p>
            If song generation fails due to a technical fault in the System, the credits used for that attempt are
            automatically refunded to your account — no request is needed.
          </p>

          <h2>4. Monthly Subscriptions</h2>
          <p>
            You may cancel a subscription at any time from your account area. Cancellation only prevents the next
            charge; no partial refund is issued for the current, already-paid period, but credits already granted
            remain available until their expiry date.
          </p>

          <h2>5. Before a Chargeback</h2>
          <p>
            We&apos;re happy to resolve any issue directly — please contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> before initiating a chargeback with your card
            issuer.
          </p>

          <h2>6. Refund Processing</h2>
          <p>
            All refunds are processed by Lemon Squeezy, the Merchant of Record for every order, within 5–10
            business days of approval.
          </p>
        </>
      }
    >
      <p>עודכן לאחרונה: {LAST_UPDATED}</p>

      <h2>1. קרדיטים שלא נוצלו</h2>
      <p>
        ניתן לבקש החזר מלא על קרדיטים שנרכשו ולא נוצלו, בתוך 14 יום ממועד הרכישה, על ידי פנייה
        ל-<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. קרדיטים שנוצלו</h2>
      <p>קרדיטים ששימשו ליצירת שיר (שיר מלא, גרסה נוספת, או שינוי) אינם ניתנים להחזר — התוצר הדיגיטלי כבר סופק במלואו.</p>

      <h2>3. כשל טכני</h2>
      <p>אם הפקת שיר נכשלה עקב תקלה טכנית במערכת, הקרדיטים שנוצלו לניסיון זה מוחזרים באופן אוטומטי לחשבונך, ללא צורך בפנייה.</p>

      <h2>4. מנויים חודשיים</h2>
      <p>
        ניתן לבטל מנוי בכל עת מהאזור האישי באתר. הביטול מונע את החיוב הבא בלבד; לא ניתן זיכוי יחסי על התקופה
        הנוכחית שכבר שולמה, אך הקרדיטים שכבר התקבלו נשארים זמינים עד לתאריך תפוגתם.
      </p>

      <h2>5. לפני חיוב חוזר (Chargeback)</h2>
      <p>
        נשמח לפתור כל בעיה ישירות — לפני פתיחת חיוב חוזר מול חברת האשראי, מומלץ ליצור קשר איתנו
        ב-<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>6. עיבוד ההחזר</h2>
      <p>כלל ההחזרים מעובדים על ידי Lemon Squeezy, ה-Merchant of Record של כל הזמנה, בתוך 5–10 ימי עסקים ממועד האישור.</p>
    </LegalPageShell>
  );
}
