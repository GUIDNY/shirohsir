"use client";

import { useState } from "react";
import { PricingPlan } from "@/lib/pricing-catalog";
import { CheckSmall, Loader, Lock } from "./icons";
import { useAccount } from "./useAccount";

// Confirm-and-pay step for a single plan already chosen on the pricing
// section — the tabs/cards live there, this modal only handles the
// "תהליך רכישה" checkout steps (summary, total, one-time vs. subscription
// notice, pay, success). Real payment isn't connected yet, so "pay" is
// the same disclosed demo-checkout pattern used elsewhere on the site —
// credits are granted only after this call succeeds, never before.
export function BillingModal({
  account,
  plan,
  onClose,
  onSuccess,
}: {
  account: ReturnType<typeof useAccount>;
  plan: PricingPlan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPurchase = async () => {
    const accessToken = account.session?.access_token;

    if (!accessToken) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const endpoint = plan.isSubscription ? "/api/billing/subscribe" : "/api/billing/purchase";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ productId: plan.id, idempotencyKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "משהו השתבש, אפשר לנסות שוב.");
        return;
      }

      setMessage(
        plan.isSubscription
          ? "ברוכים הבאים למועדון! הקרדיטים החודשיים נוספו לחשבון שלך."
          : "הרכישה הושלמה בהצלחה והקרדיטים נוספו לחשבון שלך.",
      );
      void account.refreshCredits();
      window.setTimeout(() => onSuccess(), 1400);
    } catch {
      setError("משהו השתבש, אפשר לנסות שוב.");
    } finally {
      setPending(false);
    }
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

        <p className="billing-demo-note">מצב הדגמה — לא מתבצע חיוב אמיתי בכרטיס אשראי. סליקה אמיתית תתחבר בהמשך.</p>

        {error && <p className="billing-error">{error}</p>}
        {message && <p className="billing-success">{message}</p>}

        <button className="checkout-pay-button" disabled={pending || !!message} onClick={() => void runPurchase()} type="button">
          {pending ? <Loader size={18} /> : <Lock size={18} />}
          {pending ? "מעבדים את התשלום..." : plan.buttonText}
        </button>
      </div>
    </div>
  );
}
