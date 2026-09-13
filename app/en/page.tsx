import type { Metadata } from "next";
import { EnglishDocumentLocale } from "../EnglishDocumentLocale";
import { EnglishOrderPage } from "./EnglishOrderPage";

const title = "Shirli — AI-Generated Personal Songs, Sung in English";
const description =
  "Tell us your story and get a real, original song sung in English — AI-written lyrics, AI-composed music, ready to download in minutes. Credit-based pricing, no subscription required.";

// This page needs client-side state (the order tool below), so per
// Next.js App Router rules a page exporting `metadata` must stay a
// Server Component — the same split app/layout.tsx uses for the Hebrew
// homepage (see the comment there): metadata lives here, the actual UI
// is a "use client" component this file only renders.
export const metadata: Metadata = {
  title,
  description,
  // The English counterpart of the Hebrew homepage — hreflang mirrors the
  // homepage's (app/layout.tsx).
  alternates: {
    canonical: "/en",
    languages: {
      he: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title,
    description,
    url: "/en",
    locale: "en_US",
    images: ["/og.png"],
  },
};

export default function Page() {
  return (
    <>
      <EnglishDocumentLocale />
      <EnglishOrderPage />
    </>
  );
}
