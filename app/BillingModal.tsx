"use client";

import { useState } from "react";
import { buildCheckoutUrl } from "@/lib/lemonsqueezy-catalog";
import { PricingPlan } from "@/lib/pricing-catalog";
import { CheckSmall, Lock } from "./icons";
import { useAccount } from "./useAccount";

// Confirm step for a plan already chosen on the pricing section — the
// tabs/cards live there, this modal only shows the summary before
// sending the customer to Lemon Squeezy's real hosted checkout. Credits
// are granted only once the webhook confirms payment
// (app/api/webhooks/lemonsqueezy/route.ts) — never here, and never
// before Lemon Squeezy has actually charged the card.
export function BillingModal({
  account,
  plan,
  onClose,
}: {
  account: ReturnType<typeof useAccount>;
  plan: PricingPlan;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const goToCheckout = () => {
    const user = account.session?.user;

    if (!user) {
      return;
    }

    const checkoutUrl = buildCheckoutUrl(plan.id, { id: user.id, email: user.email });

    if (!checkoutUrl) {
      setError("המסלול הזה לא זמין כרגע לרכישה — נא לפנות אלינו.");
      return;
    }

    window.location.href = checkoutUrl;
  };

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal checkout-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-header">
          <h3>סיכום הזמנה</h3>
          <button aria-label="סגירה" className="billing-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="checkout-summary">
          <div className="checkout-summary-row">
            <span>מסלול</span>
            <strong>{plan.name}</strong>
          </div>
          <div className="checkout-summary-row">
            <span>סוג רכישה</span>
            <strong>{plan.isSubscription ? "מנוי חודשי מתחדש" : "רכישה חד-פעמית"}</strong>
          </div>
          <div className="checkout-summary-row">
            <span>מחיר לתשלום</span>
            <strong dir="ltr">
              {plan.priceIls} ₪{plan.isSubscription ? " / חודש" : ""}
              {plan.compareAtPriceIls && <span className="checkout-strike">{plan.compareAtPriceIls} ₪</span>}
            </strong>
          </div>
        </div>

        {plan.isSubscription && (
          <p className="checkout-renewal-note">
            המנוי מתחדש אוטומטית מדי חודש ב-{plan.priceIls} ₪, עד לביטול. אפשר לבטל בכל עת מאזור הקרדיטים שלכם.
          </p>
        )}

        <ul className="checkout-features">
          {plan.features.map((feature) => (
            <li key={feature}>
              <CheckSmall size={14} />
              {feature}
            </li>
          ))}
        </ul>

        {error && <p className="billing-error">{error}</p>}

        <button className="checkout-pay-button" onClick={goToCheckout} type="button">
          <Lock size={18} />
          {plan.buttonText}
        </button>
      </div>
    </div>
  );
}
