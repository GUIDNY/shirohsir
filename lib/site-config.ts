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
