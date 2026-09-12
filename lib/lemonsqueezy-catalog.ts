// Single source of truth mapping our pricing plans (lib/pricing-catalog.ts)
// to Lemon Squeezy identifiers — looked up via the API, never guessed
// (see scripts/lemonsqueezy-list-variants.mjs).
//
// IMPORTANT: Lemon Squeezy has two distinct IDs per product and they are
// NOT interchangeable:
// - the numeric `variant_id` (e.g. 1997405) — what webhook payloads
//   reference (data.attributes.first_order_item.variant_id /
//   data.attributes.variant_id). Used by the webhook handler.
// - the checkout buy-link, a UUID slug that only appears on the
//   PRODUCT's own `buy_now_url` (e.g.
//   .../checkout/buy/cad0d9dc-1ffd-4b8b-b9a5-65155c2694c3) — NOT the
//   numeric variant_id. Using the numeric ID in the checkout URL 404s.
//   Used by buildCheckoutUrl() below.

export const LEMONSQUEEZY_STORE_URL = "https://myshirli.lemonsqueezy.com";

// variant_id -> our plan id (see lib/pricing-catalog.ts findPricingPlan).
// Used by the webhook handler — these are the LIVE (non-test_mode) variant
// ids, confirmed via GET /v1/variants?filter[product_id]=... with the live
// API key on 2026-09-12, matching the live product prices exactly.
export const LEMONSQUEEZY_VARIANT_TO_PLAN: Record<string, string> = {
  "2119422": "single-song",
  "2119448": "pack-3",
  "2119466": "pack-5",
  "2119476": "plan-personal",
  "2119509": "plan-family",
  "2119526": "plan-creators",
};

// plan id -> real checkout URL, fetched from each LIVE product's own
// buy_now_url via the API (GET /v1/products?filter[store_id]=448289) using
// the live API key.
const PLAN_TO_CHECKOUT_URL: Record<string, string> = {
  "single-song": "https://myshirli.lemonsqueezy.com/checkout/buy/45bb91b9-4709-42c3-8376-653ae84382d0",
  "pack-3": "https://myshirli.lemonsqueezy.com/checkout/buy/e923a771-151f-4d36-9c43-548e7fedaef4",
  "pack-5": "https://myshirli.lemonsqueezy.com/checkout/buy/38b13600-dfdb-42c6-af6b-508324a24b66",
  "plan-personal": "https://myshirli.lemonsqueezy.com/checkout/buy/f1e2a476-ce30-47a0-954e-365fde7c5d76",
  "plan-family": "https://myshirli.lemonsqueezy.com/checkout/buy/0d183d4b-8312-4971-8515-fa7581c67a31",
  "plan-creators": "https://myshirli.lemonsqueezy.com/checkout/buy/3106fe35-8d95-42fe-8e86-1816913bb2f7",
};

export function buildCheckoutUrl(planId: string, user: { id: string; email?: string | null }): string | null {
  const baseUrl = PLAN_TO_CHECKOUT_URL[planId];

  if (!baseUrl) {
    return null;
  }

  const params = new URLSearchParams({ "checkout[custom][user_id]": user.id });

  if (user.email) {
    params.set("checkout[email]", user.email);
  }

  return `${baseUrl}?${params.toString()}`;
}
