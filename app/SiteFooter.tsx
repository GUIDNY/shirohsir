import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site-config";

// Plain component (no hooks, no "use client") so it can drop into both
// client pages (page.tsx, /pricing) and plain server pages (/terms,
// /privacy, /refund-policy, /en) without converting them to client
// components. Carries the site-wide policy links + a real contact email,
// which the app had none of anywhere before this.
// locale defaults to "he" so every existing caller (the Hebrew homepage,
// /pricing, /terms, /privacy, /refund-policy) renders byte-identical to
// before this prop existed. The English order flow passes locale="en" so
// an English visitor never sees a Hebrew link — including the legal
// pages, which are linked at their #english-version anchor rather than
// their (Hebrew-first) top.
export function SiteFooter({ locale = "he" }: { locale?: "he" | "en" }) {
  const isEnglish = locale === "en";

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="brand-mark">
            <img src="/logo.png" alt="Shirli" />
          </span>
        </div>

        {isEnglish ? (
          <nav className="site-footer-links" aria-label="Legal links">
            <Link href="/terms#english-version">Terms of Service</Link>
            <Link href="/privacy#english-version">Privacy Policy</Link>
            <Link href="/refund-policy#english-version">Refund Policy</Link>
          </nav>
        ) : (
          <nav className="site-footer-links" aria-label="קישורים משפטיים">
            <Link href="/faq">שאלות נפוצות</Link>
            <Link href="/terms">תנאי שימוש</Link>
            <Link href="/privacy">מדיניות פרטיות</Link>
            <Link href="/refund-policy">מדיניות החזרים</Link>
            <Link href="/en">English</Link>
          </nav>
        )}

        <a className="site-footer-contact" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </div>

      <div className="site-footer-credit" dir="ltr">
        Powered by ElevenLabs Music
      </div>
    </footer>
  );
}
