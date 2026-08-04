// Single source of truth for pack/plan definitions — imported by both the
// API routes (which look up price/credits by id, never trusting a client-
// sent amount) and the client UI (which only needs it for display).
// Real payment isn't connected yet: purchases here are simulated. See
// DUMMY_BILLING_CAP_CREDITS below for the abuse guard on a live site.

export type CreditPack = {
  id: string;
  label: string;
  credits: number;
  priceIls: number;
};

export type SubscriptionPlan = {
  id: string;
  label: string;
  monthlyCredits: number;
  priceIls: number;
};

export const creditPacks: CreditPack[] = [
  { id: "pack-5", label: "חבילה קטנה", credits: 5, priceIls: 25 },
  { id: "pack-15", label: "חבילה בינונית", credits: 15, priceIls: 65 },
  { id: "pack-40", label: "חבילה גדולה", credits: 40, priceIls: 150 },
];

export const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-basic", label: "מנוי בסיסי", monthlyCredits: 20, priceIls: 90 },
  { id: "plan-pro", label: "מנוי פרו", monthlyCredits: 60, priceIls: 220 },
];

// Real payment isn't wired up — purchases just grant credits directly.
// Cap total lifetime dummy-granted credits per account so this can't be
// abused as a free-credits faucet on the live site before checkout exists.
export const DUMMY_BILLING_CAP_CREDITS = 300;

// One-time bonus for sharing on Facebook. Not verified server-side (that
// would need Facebook app review) — trust-based like the "click to open
// the share dialog" pattern most small apps use, bounded by being
// claimable exactly once per account (see profiles.share_bonus_claimed).
export const SHARE_BONUS_CREDITS = 1;

// Referral bonuses (granted by the handle_new_user DB trigger, not here —
// this file isn't imported by SQL, kept for documentation/consistency):
// +5 credits to the referrer (capped at 10 successful referrals lifetime),
// +2 extra credits to the referred signup on top of the normal signup bonus.
