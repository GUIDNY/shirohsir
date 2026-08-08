import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_URL, OLD_DOMAIN_HOST } from "@/lib/site-config";

// Permanently redirects the previous default Vercel domain to the real
// custom domain, so it stops serving a duplicate copy of the site.
// Matches the exact old production hostname only — preview deployments
// get their own distinct hostnames and are unaffected.
export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === OLD_DOMAIN_HOST) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
    return NextResponse.redirect(url, 308);
  }
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
