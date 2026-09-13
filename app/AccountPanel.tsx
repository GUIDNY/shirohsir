"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "./useAccount";
import { ChevronDown, Loader, UserCircle } from "./icons";
import { CreditWalletModal } from "./CreditWalletModal";
import { MySongsModal } from "./MySongsModal";

type Mode = "signIn" | "signUp";

function ReferralModal({
  account,
  onClose,
  locale = "he",
}: {
  account: ReturnType<typeof useAccount>;
  onClose: () => void;
  locale?: "he" | "en";
}) {
  const { credits, session, refreshCredits } = account;
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const referralLink =
    credits?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${credits.referralCode}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareOnFacebook = async () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );

    if (credits?.shareBonusClaimed || !session?.access_token) {
      return;
    }

    setClaiming(true);
    setShareMessage(null);

    try {
      const response = await fetch("/api/billing/claim-share-bonus", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setShareMessage(
          locale === "en" ? "You got a sharing bonus! Your balance has been updated." : "קיבלת בונוס על השיתוף! היתרה שלך עודכנה.",
        );
        void refreshCredits();
      }
    } catch {
      // silent — the share dialog already opened, the bonus is a nice-to-have
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal referral-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-header">
          <h3>{locale === "en" ? "Invite friends" : "הזמנת חברים"}</h3>
          <button aria-label={locale === "en" ? "Close" : "סגירה"} className="billing-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <p className="billing-demo-note">
          {locale === "en"
            ? "Every friend who signs up with your link gets a welcome bonus — and so do you."
            : "כל חבר שנרשם עם הקישור שלכם מקבל בונוס הצטרפות — וגם אתם."}
        </p>

        <div className="referral-link-row">
          <input dir="ltr" readOnly value={referralLink} />
          <button type="button" onClick={() => void copyLink()}>
            {locale === "en" ? (copied ? "Copied!" : "Copy") : copied ? "הועתק!" : "העתקה"}
          </button>
        </div>

        {!credits?.shareBonusClaimed ? (
          <button className="referral-share" disabled={claiming} onClick={() => void shareOnFacebook()} type="button">
            {claiming && <Loader size={14} />}
            {locale === "en" ? "Share on Facebook" : "שיתוף בפייסבוק"}
          </button>
        ) : (
          shareMessage === null && (
            <p className="referral-claimed">
              {locale === "en" ? "You’ve already claimed your sharing bonus" : "כבר קיבלתם בונוס על שיתוף"}
            </p>
          )
        )}
        {shareMessage && <p className="referral-claimed">{shareMessage}</p>}
      </div>
    </div>
  );
}

export function AccountPanel({
  account,
  locale = "he",
}: {
  account: ReturnType<typeof useAccount>;
  // Optional locale override — defaults to Hebrew so every existing caller
  // (all of them, today) renders byte-identical to before this prop existed.
  locale?: "he" | "en";
}) {
  const { session, user, authLoading, authError, credits, signUp, signIn, signOut } = account;
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referralCodeFromUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("ref");
  });
  const [mode, setMode] = useState<Mode>(() => (referralCodeFromUrl ? "signUp" : "signIn"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [songsOpen, setSongsOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The wallet's actions may be opened from any page (home or the
  // dedicated /pricing page) — navigate across pages when needed,
  // scroll in place when already there.
  const goToOrderSection = () => {
    if (window.location.pathname === "/") {
      scrollToSection("order");
    } else {
      window.location.href = "/#order";
    }
  };

  const goToPricingPage = () => {
    if (window.location.pathname === "/pricing") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.location.href = "/pricing";
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setConfirmationSent(false);

    if (mode === "signIn") {
      const ok = await signIn(email, password);
      if (ok) {
        setOpen(false);
        setPassword("");
      }
    } else {
      const { needsEmailConfirmation } = await signUp(email, password, referralCodeFromUrl || undefined);
      if (needsEmailConfirmation) {
        setConfirmationSent(true);
        setPassword("");
      } else {
        setOpen(false);
        setPassword("");
      }
    }

    setSubmitting(false);
  };

  if (authLoading) {
    return <div className="account-pill account-pill-loading">{locale === "en" ? "One moment..." : "רק רגע..."}</div>;
  }

  if (session && user) {
    const isAdmin = credits?.isAdmin === true;

    return (
      <div className="account-widget">
        {!isAdmin && typeof credits?.balance === "number" && (
          <span className="header-balance" title={locale === "en" ? "Your balance for creating songs" : "היתרה שלך ליצירת שירים"}>
            {locale === "en" ? `Balance: ${credits.balance}` : `יתרה: ${credits.balance}`}
          </span>
        )}

        <button
          aria-expanded={menuOpen}
          aria-label={locale === "en" ? "User menu" : "תפריט משתמש"}
          className="user-menu-trigger"
          onClick={() => setMenuOpen((v) => !v)}
          type="button"
        >
          <UserCircle size={22} />
          <ChevronDown size={13} />
        </button>

        {menuOpen && (
          <div className="user-menu">
            <div className="user-menu-email" dir="ltr">
              {user.email}
            </div>
            {isAdmin && <span className="user-menu-admin-tag">{locale === "en" ? "Admin view" : "מסך ניהול"}</span>}
            <button
              type="button"
              onClick={() => {
                setSongsOpen(true);
                setMenuOpen(false);
              }}
            >
              {locale === "en" ? "My Songs" : "השירים שלי"}
            </button>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setReferralOpen(true);
                  setMenuOpen(false);
                }}
              >
                {locale === "en" ? "Invite friends" : "הזמנת חברים"}
              </button>
            )}
            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setWalletOpen(true);
                  setMenuOpen(false);
                }}
              >
                {locale === "en" ? "My Credits" : "הקרדיטים שלי"}
              </button>
            )}
            <button
              className="user-menu-signout"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
            >
              {locale === "en" ? "Sign out" : "התנתקות"}
            </button>
          </div>
        )}

        {walletOpen && (
          <CreditWalletModal
            account={account}
            locale={locale}
            onClose={() => setWalletOpen(false)}
            onBuyCredits={() => {
              setWalletOpen(false);
              goToPricingPage();
            }}
            onNewSong={() => {
              setWalletOpen(false);
              goToOrderSection();
            }}
          />
        )}
        {songsOpen && <MySongsModal account={account} locale={locale} onClose={() => setSongsOpen(false)} />}
        {referralOpen && <ReferralModal account={account} locale={locale} onClose={() => setReferralOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="account-widget">
      <button
        className="account-pill account-trigger"
        id="account-trigger-btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        {locale === "en" ? "Sign in" : "התחברות"}
      </button>

      {open && (
        <div className="account-popover">
          <div className="account-tabs">
            <button
              className={mode === "signIn" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("signIn");
                setConfirmationSent(false);
              }}
            >
              {locale === "en" ? "Sign in" : "התחברות"}
            </button>
            <button
              className={mode === "signUp" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("signUp");
                setConfirmationSent(false);
              }}
            >
              {locale === "en" ? "Sign up" : "הרשמה"}
            </button>
          </div>

          {confirmationSent ? (
            <p className="account-confirmation">
              {locale === "en"
                ? `We sent a confirmation email to ${email}. Click the link there to activate your account.`
                : `שלחנו מייל אישור ל־${email}. לוחצים על הקישור שם כדי להפעיל את החשבון.`}
            </p>
          ) : (
            <form className="account-form" onSubmit={submit}>
              <label>
                {locale === "en" ? "Email" : "אימייל"}
                <input
                  dir="ltr"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label>
                {locale === "en" ? "Password" : "סיסמה"}
                <input
                  dir="ltr"
                  minLength={6}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={locale === "en" ? "At least 6 characters" : "לפחות 6 תווים"}
                />
              </label>

              {authError && <p className="account-error">{authError}</p>}

              <button className="account-submit" disabled={submitting} type="submit">
                {submitting && <Loader size={16} />}
                {locale === "en"
                  ? mode === "signIn"
                    ? "Sign in"
                    : "Create account"
                  : mode === "signIn"
                    ? "התחברות"
                    : "יצירת חשבון"}
              </button>

              {mode === "signUp" && (
                <p className="account-hint">
                  {locale === "en"
                    ? referralCodeFromUrl
                      ? "You were invited by a friend — you’ll get a welcome bonus!"
                      : "Get free starting credits."
                    : referralCodeFromUrl
                      ? "הוזמנתם על ידי חבר — תקבלו בונוס הצטרפות!"
                      : "מקבלים יתרה חינם להתחלה."}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
