import type { Metadata } from "next";
import Link from "next/link";
import { MusicNote } from "../icons";
import { SiteFooter } from "../SiteFooter";
import { creditPacks, CREDITS_PER_SONG, singleSongPlan, subscriptionPlans } from "@/lib/pricing-catalog";

const title = "My Shirli — AI-Generated Personal Songs in Hebrew";
const description =
  "A fully automated SaaS app that turns your story into a personal Hebrew song — no human involvement, credit-based pricing.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/en",
  },
  openGraph: {
    title,
    description,
    url: "/en",
    images: ["/og.png"],
  },
};

const STEPS = [
  { title: "Choose a song type", detail: "Birthday, wedding, relationship, business, or any other occasion." },
  { title: "Tell your story", detail: "Add names, memories, jokes, and special moments." },
  { title: "Confirm what we understood", detail: "The system shows a short automatic summary before production." },
  { title: "Download your song", detail: "Two finished audio versions, available in your account area." },
];

const PACK_NAMES_EN: Record<string, string> = {
  "pack-3": "3-song pack",
  "pack-5": "5-song pack",
};

const PLAN_NAMES_EN: Record<string, string> = {
  "plan-personal": "Personal",
  "plan-family": "Family",
  "plan-creators": "Creators",
};

export default function EnglishPage() {
  return (
    <main className="en-page" dir="ltr" lang="en">
      <header className="legal-topbar">
        <Link className="brand" href="/en">
          <span className="brand-mark">
            <MusicNote size={18} strokeWidth={2.1} />
          </span>
          <span>My Shirli</span>
        </Link>
        <Link className="legal-back-link" href="/">
          עברית
        </Link>
      </header>

      <section className="en-hero">
        <p className="en-eyebrow">Fully automated · AI-generated · Hebrew personal songs</p>
        <h1>Turn your story into a personal Hebrew song.</h1>
        <p className="en-hero-text">
          My Shirli is a credit-based SaaS application. You submit a story, the system automatically writes
          lyrics, composes music, and produces two finished audio versions — ready to download and share. There is
          no human involvement anywhere in the generation process, from checkout to download.
        </p>
        <Link className="en-cta" href="/#order">
          Start creating (Hebrew interface) →
        </Link>
      </section>

      <section className="en-steps">
        <h2>How it works</h2>
        <div className="en-steps-grid">
          {STEPS.map((step, index) => (
            <div className="en-step-card" key={step.title}>
              <span className="en-step-number">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
        <p className="en-steps-credit">Songs are generated using ElevenLabs Music technology.</p>
      </section>

      <section className="en-pricing">
        <h2>Pricing</h2>
        <p className="en-pricing-note">
          {CREDITS_PER_SONG} credits = one full song (two audio versions, up to 3 minutes each). All prices in
          ₪ (ILS), charged and receipted by Lemon Squeezy.
        </p>

        <div className="en-pricing-grid">
          <div className="en-pricing-card">
            <h3>Single song</h3>
            <div className="en-pricing-price">₪{singleSongPlan.priceIls}</div>
            <p>{singleSongPlan.credits} credits, one-time purchase.</p>
          </div>

          {creditPacks.map((pack) => (
            <div className="en-pricing-card" key={pack.id}>
              <h3>{PACK_NAMES_EN[pack.id] ?? pack.name}</h3>
              <div className="en-pricing-price">₪{pack.priceIls}</div>
              <p>{pack.credits} credits, one-time purchase, never expires.</p>
            </div>
          ))}
        </div>

        <h3 className="en-pricing-subheading">Monthly subscriptions</h3>
        <div className="en-pricing-grid">
          {subscriptionPlans.map((plan) => (
            <div className="en-pricing-card" key={plan.id}>
              <h3>{PLAN_NAMES_EN[plan.id] ?? plan.name}</h3>
              <div className="en-pricing-price">
                ₪{plan.priceIls}
                <span>/mo</span>
              </div>
              <p>{plan.credits} credits per month, cancel anytime.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="en-legal-links">
        <h2>Policies</h2>
        <p>
          <Link href="/terms#english-version">Terms of Service</Link> ·{" "}
          <Link href="/privacy#english-version">Privacy Policy</Link> ·{" "}
          <Link href="/refund-policy#english-version">Refund Policy</Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
