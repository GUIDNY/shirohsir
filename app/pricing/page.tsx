"use client";

import { useState } from "react";
import Link from "next/link";
import { BillingModal } from "../BillingModal";
import { PricingSection, PricingTab } from "../PricingSection";
import { promptSignIn } from "../promptSignIn";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { useAccount } from "../useAccount";
import { PricingPlan } from "@/lib/pricing-catalog";

function initialTabFromUrl(): PricingTab {
  if (typeof window === "undefined") {
    return "single";
  }

  const requested = new URLSearchParams(window.location.search).get("tab");

  return requested === "packs" || requested === "subscriptions" ? requested : "single";
}

export default function PricingPage() {
  const account = useAccount();
  const [tab, setTab] = useState<PricingTab>(() => initialTabFromUrl());
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlan | null>(null);

  const handleSelectPlan = (plan: PricingPlan) => {
    if (!account.session) {
      promptSignIn();
      return;
    }

    setCheckoutPlan(plan);
  };

  return (
    <main className="site-shell pricing-page" dir="rtl">
      <SiteHeader
        account={account}
        navLinks={[
          { href: "/", label: "בית" },
          { href: "/#how", label: "איך זה עובד" },
          { href: "/#legal", label: "מה מותר" },
        ]}
        onNewSong={() => {
          window.location.href = "/#order";
        }}
      />

      <section className="pricing-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          מחירים
        </p>
        <h1>בוחרים איך לקבל את השיר שלכם.</h1>
        <p className="pricing-hero-text">
          שיר בודד, חבילה שחוסכת לכם, או מנוי חודשי — כל הדרכים נותנות קרדיטים לאותה מערכת פשוטה וברורה.
          לא בטוחים? אפשר להתחיל עם{" "}
          <Link href="/#demo" className="pricing-hero-link">
            דמו אישי בחינם
          </Link>
          .
        </p>
      </section>

      <div className="pricing-page-body">
        <PricingSection onSelectPlan={handleSelectPlan} onTabChange={setTab} tab={tab} />
      </div>

      <SiteFooter />

      {checkoutPlan && (
        <BillingModal
          account={account}
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setCheckoutPlan(null);
            window.location.href = "/#order";
          }}
        />
      )}
    </main>
  );
}
