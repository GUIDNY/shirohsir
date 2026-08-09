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
// Used by the webhook handler — confirmed correct via live testing.
export const LEMONSQUEEZY_VARIANT_TO_PLAN: Record<string, string> = {
  "1997405": "single-song",
  "1997408": "pack-3",
  "1997410": "pack-5",
  "1997419": "plan-personal",
  "1997425": "plan-family",
  "1997431": "plan-creators",
};

// plan id -> real checkout URL, fetched from each product's own
// buy_now_url via the API (GET /v1/products?filter[store_id]=448289).
const PLAN_TO_CHECKOUT_URL: Record<string, string> = {
  "single-song": "https://myshirli.lemonsqueezy.com/checkout/buy/cad0d9dc-1ffd-4b8b-b9a5-65155c2694c3",
  "pack-3": "https://myshirli.lemonsqueezy.com/checkout/buy/21ee6adc-e45b-4e96-bc2f-7acf584b8cd9",
  "pack-5": "https://myshirli.lemonsqueezy.com/checkout/buy/46f5dd24-fe24-47aa-9b33-733f3590530a",
  "plan-personal": "https://myshirli.lemonsqueezy.com/checkout/buy/48261a08-d1f8-4f86-92b9-8225b747980b",
  "plan-family": "https://myshirli.lemonsqueezy.com/checkout/buy/b6f075d1-d3f5-457b-ab7c-6decb139574b",
  "plan-creators": "https://myshirli.lemonsqueezy.com/checkout/buy/9a11da4f-2309-4400-a743-39af8ee27c17",
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
