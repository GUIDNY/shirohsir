"use client";

import { useState } from "react";
import { PricingPlan, creditPacks, pricingFaq, singleSongPlan, subscriptionPlans } from "@/lib/pricing-catalog";
import { CheckSmall, ChevronDown } from "./icons";

export type PricingTab = "single" | "packs" | "subscriptions";

function PricingCard({ plan, onSelect }: { plan: PricingPlan; onSelect: (plan: PricingPlan) => void }) {
  return (
    <div className={plan.badge ? "pricing-card pricing-card--featured" : "pricing-card"}>
      {plan.badge && <span className="pricing-card-badge">{plan.badge}</span>}

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
    <section id="pricing" className="pricing-section">
      <div className="section-intro">
        <p className="eyebrow">מחירים</p>
        <h2>בוחרים איך לקבל את השיר שלכם.</h2>
        <p>שיר בודד, חבילה שחוסכת לכם, או מנוי חודשי — כל הדרכים נותנות קרדיטים לאותה מערכת פשוטה.</p>
      </div>

      <div className="pricing-tabs" role="tablist">
        <button aria-selected={tab === "single"} className={tab === "single" ? "active" : ""} onClick={() => onTabChange("single")} role="tab" type="button">
          שיר בודד
        </button>
        <button aria-selected={tab === "packs"} className={tab === "packs" ? "active" : ""} onClick={() => onTabChange("packs")} role="tab" type="button">
          חבילות שירים
        </button>
        <button
          aria-selected={tab === "subscriptions"}
          className={tab === "subscriptions" ? "active" : ""}
          onClick={() => onTabChange("subscriptions")}
          role="tab"
          type="button"
        >
          מנויים חודשיים
        </button>
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
    </section>
  );
}
