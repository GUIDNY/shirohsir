"use client";

import { useState } from "react";
import { creditPacks, subscriptionPlans } from "@/lib/billing-catalog";
import { Loader } from "./icons";
import { useAccount } from "./useAccount";

type Tab = "packs" | "plans";

export function BillingModal({
  account,
  onClose,
}: {
  account: ReturnType<typeof useAccount>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("packs");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPurchase = async (endpoint: string, body: Record<string, string>, id: string) => {
    const accessToken = account.session?.access_token;

    if (!accessToken) {
      return;
    }

    setPendingId(id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "משהו השתבש, אפשר לנסות שוב.");
        return;
      }

      setMessage(`נוספו ${data.credits} יחידות ליתרה שלך (מצב הדגמה — בלי חיוב אמיתי).`);
      void account.refreshCredits();
    } catch {
      setError("משהו השתבש, אפשר לנסות שוב.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-header">
          <h3>הוספת יתרה</h3>
          <button aria-label="סגירה" className="billing-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <p className="billing-demo-note">
          מצב הדגמה — לא מתבצע חיוב אמיתי בכרטיס אשראי. סליקה אמיתית תתחבר בהמשך.
        </p>

        <div className="billing-tabs">
          <button className={tab === "packs" ? "active" : ""} onClick={() => setTab("packs")} type="button">
            חבילות
          </button>
          <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")} type="button">
            מנויים
          </button>
        </div>

        {error && <p className="billing-error">{error}</p>}
        {message && <p className="billing-success">{message}</p>}

        {tab === "packs" ? (
          <div className="billing-grid">
            {creditPacks.map((pack) => (
              <div className="billing-card" key={pack.id}>
                <strong>{pack.credits} יחידות</strong>
                <span>{pack.label}</span>
                <div className="billing-price">{pack.priceIls} ש״ח</div>
                <button
                  className="billing-buy"
                  disabled={pendingId === pack.id}
                  onClick={() => runPurchase("/api/billing/purchase", { packId: pack.id }, pack.id)}
                  type="button"
                >
                  {pendingId === pack.id ? <Loader size={16} /> : "קנייה"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="billing-grid">
            {subscriptionPlans.map((plan) => (
              <div className="billing-card" key={plan.id}>
                <strong>{plan.monthlyCredits} יחידות לחודש</strong>
                <span>{plan.label}</span>
                <div className="billing-price">{plan.priceIls} ש״ח / חודש</div>
                <button
                  className="billing-buy"
                  disabled={pendingId === plan.id}
                  onClick={() => runPurchase("/api/billing/subscribe", { planId: plan.id }, plan.id)}
                  type="button"
                >
                  {pendingId === plan.id ? <Loader size={16} /> : "הרשמה"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
