import { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "./SiteFooter";

// Shared shell for /terms, /privacy, /refund-policy: a minimal static
// header (no account state needed — these are pure reading pages), the
// Hebrew content, then the full English translation on the same URL
// (rather than behind a language toggle a reviewer might not find).
// Also used by the Hebrew-only /faq, which simply omits the English part.
export function LegalPageShell({
  titleHe,
  titleEn,
  children,
  englishChildren,
}: {
  titleHe: string;
  titleEn?: string;
  children: ReactNode;
  englishChildren?: ReactNode;
}) {
  return (
    <main className="legal-page" dir="rtl">
      <header className="legal-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <img src="/logo.png" alt="Shirli" />
          </span>
        </Link>
        <Link className="legal-back-link" href="/">
          חזרה לעמוד הבית
        </Link>
      </header>

      <article className="legal-content">
        <h1>{titleHe}</h1>
        {children}
      </article>

      {englishChildren && (
        <>
          <div className="legal-divider">
            <span>English Version</span>
          </div>

          <article className="legal-content legal-content--en" dir="ltr" id="english-version" lang="en">
            <h1>{titleEn}</h1>
            {englishChildren}
          </article>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
