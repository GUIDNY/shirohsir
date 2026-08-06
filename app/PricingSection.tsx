"use client";

import { useState } from "react";
import { PricingPlan, creditPacks, pricingFaq, singleSongPlan, subscriptionPlans } from "@/lib/pricing-catalog";
import { CheckSmall, ChevronDown, Coin, MusicNote, Refresh } from "./icons";

export type PricingTab = "single" | "packs" | "subscriptions";

type IconComponent = (props: { size?: number }) => React.JSX.Element;

const TAB_ICON: Record<PricingTab, IconComponent> = {
  single: MusicNote,
  packs: Coin,
  subscriptions: Refresh,
};

function PricingCard({ plan, onSelect }: { plan: PricingPlan; onSelect: (plan: PricingPlan) => void }) {
  const Icon = TAB_ICON[plan.isSubscription ? "subscriptions" : plan.productType === "pack" ? "packs" : "single"];

  return (
    <div className={plan.badge ? "pricing-card pricing-card--featured" : "pricing-card"}>
      {plan.badge && <span className="pricing-card-badge">{plan.badge}</span>}

      <span className="pricing-card-icon">
        <Icon size={20} />
      </span>

      <h3 className="pricing-card-name">{plan.name}</h3>

      <div className="pricing-card-price" dir="ltr">
        <strong>{plan.priceIls} ₪</strong>
        {plan.compareAtPriceIls && <span className="pricing-card-strike">{plan.compareAtPriceIls} ₪</span>}
        {plan.isSubscription && (
          <span className="pricing-card-period" dir="rtl">
            לחודש
          </span>
        )}
      </div>

      {plan.smallPrint && <p className="pricing-card-smallprint">{plan.smallPrint}</p>}
      <p className="pricing-card-sufficient">מספיק עבור: {plan.sufficientForText}</p>
      {plan.perSongAveragePriceIls && (
        <p className="pricing-card-average">מחיר ממוצע לשיר: {plan.perSongAveragePriceIls} ₪</p>
      )}
      {plan.savingsText && <p className="pricing-card-savings">{plan.savingsText}</p>}

      <ul className="pricing-card-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <CheckSmall size={14} />
            {feature}
          </li>
        ))}
      </ul>

      <button className="pricing-card-buy" onClick={() => onSelect(plan)} type="button">
        {plan.buttonText}
      </button>
    </div>
  );
}

const TABS: Array<{ id: PricingTab; label: string }> = [
  { id: "single", label: "שיר בודד" },
  { id: "packs", label: "חבילות שירים" },
  { id: "subscriptions", label: "מנויים חודשיים" },
];

export function PricingSection({
  tab,
  onTabChange,
  onSelectPlan,
}: {
  tab: PricingTab;
  onTabChange: (tab: PricingTab) => void;
  onSelectPlan: (plan: PricingPlan) => void;
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <div className="pricing-widget">
      <div className="pricing-tabs-row">
        <div className="pricing-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              aria-selected={tab === item.id}
              className={tab === item.id ? "active" : ""}
              key={item.id}
              onClick={() => onTabChange(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "single" && (
        <div className="pricing-grid pricing-grid--single">
          <PricingCard plan={singleSongPlan} onSelect={onSelectPlan} />
        </div>
      )}

      {tab === "packs" && (
        <div className="pricing-grid pricing-grid--packs">
          {creditPacks.map((plan) => (
            <PricingCard key={plan.id} onSelect={onSelectPlan} plan={plan} />
          ))}
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="pricing-grid pricing-grid--subs">
          {subscriptionPlans.map((plan) => (
            <PricingCard key={plan.id} onSelect={onSelectPlan} plan={plan} />
          ))}
        </div>
      )}

      <div className="pricing-faq">
        <h3>שאלות ותשובות</h3>
        {pricingFaq.map((item, index) => {
          const open = openFaqIndex === index;

          return (
            <div className={open ? "faq-item open" : "faq-item"} key={item.question}>
              <button
                aria-expanded={open}
                className="faq-question"
                onClick={() => setOpenFaqIndex(open ? null : index)}
                type="button"
              >
                {item.question}
                <ChevronDown className="faq-chevron" size={16} />
              </button>
              {open && <p className="faq-answer">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
