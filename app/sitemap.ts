import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

// Every public, indexable URL — each returns 200 and is its own
// canonical. Deliberately left out: /api/*, the private
// /postcard/[token] share links, and /en/terms, /en/privacy,
// /en/refund-policy, which only redirect (307, via next/navigation's
// redirect()) to the English section of the bilingual /terms, /privacy
// and /refund-policy pages already listed here.
//
// Only / and /en have a true other-language counterpart, so only they
// carry hreflang alternates (mirrored in their page metadata). No
// lastModified: there's no reliable per-page date, and a build
// timestamp would claim every page changed on every deploy.
const homeLanguages = {
  he: SITE_URL,
  en: `${SITE_URL}/en`,
  "x-default": SITE_URL,
};

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, alternates: { languages: homeLanguages } },
    { url: `${SITE_URL}/pricing` },
    { url: `${SITE_URL}/faq` },
    { url: `${SITE_URL}/en`, alternates: { languages: homeLanguages } },
    { url: `${SITE_URL}/terms` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/refund-policy` },
  ];
}
