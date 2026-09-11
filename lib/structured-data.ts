// schema.org JSON-LD for the site, rendered through app/JsonLd.tsx and
// built only from lib/pricing-catalog.ts + lib/site-config.ts (never
// hand-typed prices or contact details):
// - siteJsonLd: Organization + WebSite, on every page (app/layout.tsx).
// - homeServiceJsonLd: the song service and its offers, homepage only.
// The /faq page builds its FAQPage from its own visible Q&A array.
// Deliberately no Review/AggregateRating — the site has no reviews.

import {
  creditPacks,
  FREE_DEMO,
  MAX_VERSION_SECONDS,
  PricingPlan,
  singleSongPlan,
  subscriptionPlans,
} from "./pricing-catalog";
import { SITE_NAME, SITE_NAME_HE, SITE_URL, SOCIAL_PROFILE_URLS, SUPPORT_EMAIL } from "./site-config";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

const ALTERNATE_NAMES = [SITE_NAME_HE, "My Shirli", "myshirli"];

export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
      email: SUPPORT_EMAIL,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        availableLanguage: ["he", "en"],
      },
      ...(SOCIAL_PROFILE_URLS.length > 0 ? { sameAs: SOCIAL_PROFILE_URLS } : {}),
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      url: SITE_URL,
      inLanguage: "he-IL",
      publisher: { "@id": ORGANIZATION_ID },
    },
  ],
};

function planOfferDescription(plan: PricingPlan) {
  const credits = plan.isSubscription ? `${plan.credits} קרדיטים בכל חודש` : `${plan.credits} קרדיטים`;
  const validity =
    plan.creditsValidityDays === null ? "ללא תפוגה" : `תקפים ל-${plan.creditsValidityDays} יום`;

  return `${plan.isSubscription ? "מנוי חודשי: " : ""}${credits} (${validity}), מספיק עבור ${plan.sufficientForText}.`;
}

function planOffer(plan: PricingPlan) {
  return {
    "@type": "Offer",
    name: plan.name,
    description: planOfferDescription(plan),
    price: plan.priceIls,
    priceCurrency: "ILS",
    // Subscriptions are billed per month — a price per 1 month (MON).
    ...(plan.isSubscription
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: plan.priceIls,
            priceCurrency: "ILS",
            referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
          },
        }
      : {}),
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/pricing`,
  };
}

const activePacks = creditPacks.filter((plan) => plan.isActive);
const activeSubscriptions = subscriptionPlans.filter((plan) => plan.isActive);
const offerCatalogName = [
  activePacks.length > 0 ? "חבילות שירים" : null,
  activeSubscriptions.length > 0 ? "מנויים חודשיים" : null,
]
  .filter(Boolean)
  .join(" ו");

export const homeServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/#service`,
  name: "שיר אישי בהתאמה אישית",
  serviceType: "יצירת שיר אישי בעברית",
  description: `מספרים למערכת על האדם, האירוע והרגעים החשובים — והיא כותבת, מלחינה ומפיקה אוטומטית שיר מקורי ואישי בעברית תוך דקות, מוכן להורדה ולשיתוף. כל שיר מלא כולל שתי גרסאות מוזיקליות באורך של עד ${MAX_VERSION_SECONDS / 60} דקות, ואפשר לשמוע קודם דמו אישי של ${FREE_DEMO.seconds} שניות בחינם.`,
  provider: { "@id": ORGANIZATION_ID },
  areaServed: "IL",
  url: SITE_URL,
  ...(singleSongPlan.isActive ? { offers: planOffer(singleSongPlan) } : {}),
  ...(offerCatalogName
    ? {
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: offerCatalogName,
          itemListElement: [...activePacks, ...activeSubscriptions].map(planOffer),
        },
      }
    : {}),
};
