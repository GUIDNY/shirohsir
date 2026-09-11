import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

// API routes and private /postcard/[token] share links stay out of
// crawlers' reach; everything else is public marketing/legal content.
const DISALLOWED_PATHS = ["/api/", "/postcard/"];

// Search engines and AI crawlers/assistants named explicitly, with the
// exact same rules as "*" — a crawler obeys only the most specific group
// matching its user agent, so this documents that they're welcome
// (and keeps /api/ and /postcard/ blocked for them too).
const NAMED_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "CCBot",
  "cohere-ai",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: NAMED_CRAWLERS, allow: "/", disallow: DISALLOWED_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
