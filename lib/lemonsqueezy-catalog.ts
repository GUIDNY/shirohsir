// Single source of truth mapping our pricing plans (lib/pricing-catalog.ts)
// to real Lemon Squeezy variant IDs — looked up via the API, never
// guessed (see scripts/lemonsqueezy-list-variants.mjs). Both the
// checkout-link builder (client) and the webhook handler (server) import
// this, so the variant<->plan mapping lives in exactly one place.

export const LEMONSQUEEZY_STORE_URL = "https://myshirli.lemonsqueezy.com";

// variant_id -> our plan id (see lib/pricing-catalog.ts findPricingPlan)
export const LEMONSQUEEZY_VARIANT_TO_PLAN: Record<string, string> = {
  "1997405": "single-song",
  "1997408": "pack-3",
  "1997410": "pack-5",
  "1997419": "plan-personal",
  "1997425": "plan-family",
  "1997431": "plan-creators",
};

// Reverse lookup for building checkout links from a plan id.
const PLAN_TO_VARIANT: Record<string, string> = Object.fromEntries(
  Object.entries(LEMONSQUEEZY_VARIANT_TO_PLAN).map(([variantId, planId]) => [planId, variantId]),
);

export function variantIdForPlan(planId: string): string | undefined {
  return PLAN_TO_VARIANT[planId];
}

export function buildCheckoutUrl(planId: string, user: { id: string; email?: string | null }): string | null {
  const variantId = variantIdForPlan(planId);

  if (!variantId) {
    return null;
  }

  const params = new URLSearchParams({ "checkout[custom][user_id]": user.id });

  if (user.email) {
    params.set("checkout[email]", user.email);
  }

  return `${LEMONSQUEEZY_STORE_URL}/checkout/buy/${variantId}?${params.toString()}`;
}
