import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site-config";

// Plain component (no hooks, no "use client") so it can drop into both
// client pages (page.tsx, /pricing) and plain server pages (/terms,
// /privacy, /refund-policy, /en) without converting them to client
// components. Carries the site-wide policy links + a real contact email,
// which the app had none of anywhere before this.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="brand-mark">
            <img src="/logo.svg" alt="" />
          </span>
          <span className="font-wordmark" dir="ltr">
            Shirli
          </span>
        </div>

        <nav className="site-footer-links" aria-label="קישורים משפטיים">
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/refund-policy">מדיניות החזרים</Link>
          <Link href="/en">English</Link>
        </nav>

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
