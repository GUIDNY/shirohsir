// Single source of truth for every purchasable thing on the site — the
// single song, the two one-time packs, and the three subscription
// plans — plus the free-demo and credit-cost constants. Both the API
// routes (which look up price/credits by id, never trusting a client-
// sent amount) and the client UI (pricing page, checkout modal) import
// this file, so prices/copy live in exactly one place.
//
// Credits are an internal product concept only — see AGENTS.md-level
// instructions: never expose provider/API/technical wording next to
// these numbers in customer-facing UI.

export type ProductType = "single_song" | "pack" | "subscription";

export type PricingPlan = {
  id: string;
  productType: ProductType;
  name: string;
  priceIls: number;
  compareAtPriceIls?: number;
  credits: number;
  // null = credits from this product never expire (single song, packs).
  // A number = credits expire this many days after being granted
  // (subscription renewals, per the 60-day rule).
  creditsValidityDays: number | null;
  isSubscription: boolean;
  isActive: boolean;
  displayOrder: number;
  badge?: string;
  buttonText: string;
  smallPrint?: string;
  savingsText?: string;
  sufficientForText: string;
  perSongAveragePriceIls?: number;
  features: string[];
};

// 10 credits = 1 full song (two versions, up to 3 minutes each).
export const CREDITS_PER_SONG = 10;
export const EXTRA_VERSION_CREDITS = 3;
export const MAJOR_EDIT_CREDITS = 3;
export const MAX_VERSION_SECONDS = 180;
export const SUBSCRIPTION_CREDIT_VALIDITY_DAYS = 60;

// Selectable song length, same credit price regardless of choice —
// shorter options exist mainly to fit tighter music-provider quotas.
export const SONG_LENGTH_OPTIONS = [
  { seconds: 60, label: "דקה אחת" },
  { seconds: 120, label: "שתי דקות" },
  { seconds: MAX_VERSION_SECONDS, label: "עד 3 דקות" },
];
export const DEFAULT_SONG_LENGTH_SECONDS = MAX_VERSION_SECONDS;

export const FREE_DEMO = {
  seconds: 20,
  creditsCost: 0,
};

export const singleSongPlan: PricingPlan = {
  id: "single-song",
  productType: "single_song",
  name: "שיר אישי",
  priceIls: 39,
  compareAtPriceIls: 49,
  credits: CREDITS_PER_SONG,
  creditsValidityDays: null,
  isSubscription: false,
  isActive: true,
  displayOrder: 1,
  buttonText: "רכישת 10 קרדיטים — 39 ₪",
  smallPrint: "כולל 10 קרדיטים ליצירת שיר מלא",
  sufficientForText: "שיר מלא אחד",
  features: [
    "שיר מלא באורך של עד 3 דקות",
    "שתי גרסאות מוזיקליות",
    "אישור המילים לפני ההפקה",
    "הורדה ושיתוף",
    "שמירה באזור האישי",
  ],
};

export const creditPacks: PricingPlan[] = [
  {
    id: "pack-3",
    productType: "pack",
    name: "חבילת 3 שירים",
    priceIls: 99,
    credits: 30,
    creditsValidityDays: null,
    isSubscription: false,
    isActive: true,
    displayOrder: 2,
    buttonText: "רכישת חבילת 3 שירים",
    savingsText: "חוסכים 18 ₪ לעומת רכישה נפרדת",
    sufficientForText: "3 שירים מלאים",
    perSongAveragePriceIls: 33,
    features: [
      "3 שירים מלאים",
      "שתי גרסאות לכל שיר",
      "אישור המילים לפני ההפקה",
      "הורדה ושיתוף",
      "קרדיטים שלא פוקעים",
    ],
  },
  {
    id: "pack-5",
    productType: "pack",
    name: "חבילת 5 שירים",
    priceIls: 149,
    credits: 50,
    creditsValidityDays: null,
    isSubscription: false,
    isActive: true,
    displayOrder: 3,
    badge: "הכי משתלם",
    buttonText: "רכישת חבילת 5 שירים",
    savingsText: "החבילה המשתלמת ביותר לרכישה חד-פעמית",
    sufficientForText: "5 שירים מלאים",
    perSongAveragePriceIls: 29.8,
    features: [
      "5 שירים מלאים",
      "שתי גרסאות לכל שיר",
      "אישור המילים לפני ההפקה",
      "הורדה ושיתוף",
      "קרדיטים שלא פוקעים",
    ],
  },
];

export const subscriptionPlans: PricingPlan[] = [
  {
    id: "plan-personal",
    productType: "subscription",
    name: "מסלול אישי",
    priceIls: 35,
    credits: 10,
    creditsValidityDays: SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
    isSubscription: true,
    isActive: true,
    displayOrder: 4,
    buttonText: "הצטרפות למסלול האישי",
    sufficientForText: "שיר מלא אחד בכל חודש",
    features: ["שיר אחד בכל חודש", "שתי גרסאות לכל שיר", "הורדה ושיתוף", "שמירה באזור האישי", "ביטול בכל עת"],
  },
  {
    id: "plan-family",
    productType: "subscription",
    name: "מסלול משפחתי",
    priceIls: 59,
    credits: 20,
    creditsValidityDays: SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
    isSubscription: true,
    isActive: true,
    displayOrder: 5,
    badge: "הפופולרי ביותר",
    buttonText: "הצטרפות למסלול המשפחתי",
    sufficientForText: "שני שירים מלאים בכל חודש",
    features: ["שני שירים בכל חודש", "שתי גרסאות לכל שיר", "הורדה ושיתוף", "שמירה באזור האישי", "ביטול בכל עת"],
  },
  {
    id: "plan-creators",
    productType: "subscription",
    name: "מסלול יוצרים",
    priceIls: 119,
    credits: 45,
    creditsValidityDays: SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
    isSubscription: true,
    isActive: true,
    displayOrder: 6,
    buttonText: "הצטרפות למסלול יוצרים",
    sufficientForText: "ארבעה שירים מלאים ועוד 5 קרדיטים לשינויים או לגרסאות נוספות",
    features: [
      "עד ארבעה שירים מלאים בכל חודש",
      "5 קרדיטים נוספים",
      "קדימות בתהליך ההפקה",
      "שתי גרסאות לכל שיר",
      "הורדה ושיתוף",
      "שמירה באזור האישי",
      "ביטול בכל עת",
    ],
  },
];

export const allPricingPlans: PricingPlan[] = [singleSongPlan, ...creditPacks, ...subscriptionPlans];

export function findPricingPlan(id: string): PricingPlan | undefined {
  return allPricingPlans.find((plan) => plan.id === id && plan.isActive);
}

// Real payment isn't connected yet — purchases just grant credits
// directly (see /api/billing/purchase and /api/billing/subscribe).
// Cap total lifetime dummy-granted credits per account so this can't
// be abused as a free-credits faucet on the live site before checkout
// exists.
export const DUMMY_BILLING_CAP_CREDITS = 500;

// One-time bonus for sharing on Facebook. Not verified server-side
// (that would need Facebook app review) — trust-based, bounded by
// being claimable exactly once per account (profiles.share_bonus_claimed).
export const SHARE_BONUS_CREDITS = 1;

// Referral bonus — granted by grant_referral_bonus_if_eligible() in
// migration 8, called from the purchase/subscribe routes right after a
// successful purchase (never at signup): +3 to the referrer, +3 to the
// referred account, once per referred account.
export const REFERRAL_BONUS_CREDITS = 3;

export type PricingFaqItem = { question: string; answer: string };

export const pricingFaq: PricingFaqItem[] = [
  {
    question: "מה אפשר לעשות עם 10 קרדיטים?",
    answer: "10 קרדיטים מאפשרים ליצור שיר מלא אחד, הכולל שתי גרסאות באורך של עד 3 דקות.",
  },
  {
    question: "האם הקרדיטים פוקעים?",
    answer: "קרדיטים שנרכשו בחבילה חד-פעמית אינם פוקעים. קרדיטים שמתקבלים במסגרת מנוי תקפים למשך 60 יום.",
  },
  {
    question: "אפשר לבטל את המנוי?",
    answer: "כן. אפשר לבטל בכל עת, והביטול ייכנס לתוקף לפני החיוב הבא.",
  },
  {
    question: "מה קורה לקרדיטים לאחר ביטול מנוי?",
    answer: "הקרדיטים שכבר קיבלת יישארו זמינים עד לתאריך התפוגה שלהם.",
  },
  {
    question: "מה קורה אם הייתה תקלה בהפקה?",
    answer: "לא תחויבו על תקלה טכנית. במקרה הצורך, הקרדיטים יוחזרו לחשבון אוטומטית.",
  },
  {
    question: "האם הדמו באמת בחינם?",
    answer: "כן. משתמש חדש יכול ליצור דמו אישי אחד באורך של 20 שניות ללא כרטיס אשראי.",
  },
];
