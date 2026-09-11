// Single source of truth for the site's canonical domain and contact
// email — hardcoded rather than sourced from a Vercel env var, since
// NEXT_PUBLIC_SITE_URL has already drifted twice (missing entirely,
// then stale after the custom domain was attached but before a
// rebuild picked it up).
export const SITE_URL = "https://www.myshirli.com";

// The previous default Vercel domain, still reachable in parallel with
// SITE_URL — redirected to it by proxy.ts.
export const OLD_DOMAIN_HOST = "shirohsir-9xud.vercel.app";

export const SUPPORT_EMAIL = "bd12123@gmail.com";

// Brand name as used in structured data (JSON-LD), llms.txt and
// metadata — the Latin wordmark plus its Hebrew spelling.
export const SITE_NAME = "Shirli";
export const SITE_NAME_HE = "שירלי";

// Official social profiles — the Organization's `sameAs` in the
// site-wide JSON-LD (lib/structured-data.ts) and the Contact section of
// /llms.txt. Values still holding a "__..." placeholder are not real
// URLs yet: every consumer reads SOCIAL_PROFILE_URLS below, which drops
// them, so a placeholder can never reach the page.
export const SOCIAL_PROFILES = {
  instagram: "https://www.instagram.com/myshirli.official/",
  // Numeric profile URL — stable and already live. Swap to
  // https://www.facebook.com/myshirli once that username is claimed.
  facebook: "https://www.facebook.com/profile.php?id=61594196104181",
};

export const SOCIAL_PROFILE_URLS = Object.values(SOCIAL_PROFILES).filter(
  (url) => url.startsWith("https://") && !url.includes("__"),
);

// Search-console ownership tokens, rendered as <meta> verification tags
// by the root layout. Empty string = tag not rendered at all.
export const GOOGLE_SITE_VERIFICATION = "QGHiyfswuDNkk_wgaxm6OaLMWJ3Qc6vNEfZ-pAq4jzA";
export const BING_SITE_VERIFICATION = "";

// IndexNow (Bing, Yandex, etc.) key. Must stay identical to the key file
// served from the site root: public/3bfc105dd81c5f2ffc3626269de5be02.txt
// (its entire content is this key).
export const INDEXNOW_KEY = "3bfc105dd81c5f2ffc3626269de5be02";
