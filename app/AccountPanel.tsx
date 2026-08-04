"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "./useAccount";
import { Loader } from "./icons";
import { BillingModal } from "./BillingModal";

type Mode = "signIn" | "signUp";

function ReferralBox({ account }: { account: ReturnType<typeof useAccount> }) {
  const { credits, session, refreshCredits } = account;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  if (!credits?.referralCode) {
    return null;
  }

  const referralLink =
    typeof window !== "undefined" ? `${window.location.origin}/?ref=${credits.referralCode}` : "";

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

    if (credits.shareBonusClaimed || !session?.access_token) {
      return;
    }

    setClaiming(true);
    setShareMessage(null);

    try {
      const response = await fetch("/api/billing/claim-share-bonus", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setShareMessage(`קיבלת ${data.credits} קרדיט על השיתוף!`);
        void refreshCredits();
      }
    } catch {
      // silent — the share dialog already opened, the bonus is a nice-to-have
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="referral-widget">
      <button className="account-buy" type="button" onClick={() => setOpen((v) => !v)}>
        הזמנת חברים
      </button>

      {open && (
        <div className="referral-box">
          <span className="referral-title">הזמן חברים, קבל 5 קרדיטים על כל חבר שנרשם</span>
          <div className="referral-link-row">
            <input dir="ltr" readOnly value={referralLink} />
            <button type="button" onClick={() => void copyLink()}>
              {copied ? "הועתק!" : "העתקה"}
            </button>
          </div>
          {!credits.shareBonusClaimed ? (
            <button
              className="referral-share"
              disabled={claiming}
              onClick={() => void shareOnFacebook()}
              type="button"
            >
              {claiming && <Loader size={14} />}
              שיתוף בפייסבוק (+1 קרדיט)
            </button>
          ) : (
            shareMessage === null && <p className="referral-claimed">כבר קיבלת את בונוס השיתוף</p>
          )}
          {shareMessage && <p className="referral-claimed">{shareMessage}</p>}
        </div>
      )}
    </div>
  );
}

export function AccountPanel({ account }: { account: ReturnType<typeof useAccount> }) {
  const { session, user, authLoading, authError, credits, creditsLoading, signUp, signIn, signOut } = account;
  const [open, setOpen] = useState(false);
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
  const [billingOpen, setBillingOpen] = useState(false);

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
    return <div className="account-pill account-pill-loading">בודק חשבון...</div>;
  }

  if (session && user) {
    return (
      <div className="account-widget">
        <div className="account-pill">
          <span className="account-email">{user.email}</span>
          <span className="account-credits-inline">
            {creditsLoading ? "…" : credits?.isAdmin ? "∞ מנהל" : `${credits?.balance ?? 0} קרדיטים`}
          </span>
        </div>
        {!credits?.isAdmin && (
          <button className="account-buy" type="button" onClick={() => setBillingOpen(true)}>
            רכישת קרדיטים
          </button>
        )}
        <button className="account-signout" type="button" onClick={() => void signOut()}>
          התנתקות
        </button>
        {!credits?.isAdmin && <ReferralBox account={account} />}
        {billingOpen && <BillingModal account={account} onClose={() => setBillingOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="account-widget">
      <button className="account-pill account-trigger" type="button" onClick={() => setOpen((v) => !v)}>
        התחברות / הרשמה
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
              התחברות
            </button>
            <button
              className={mode === "signUp" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("signUp");
                setConfirmationSent(false);
              }}
            >
              הרשמה
            </button>
          </div>

          {confirmationSent ? (
            <p className="account-confirmation">
              נשלח מייל אישור ל־{email}. יש ללחוץ על הקישור שם כדי להפעיל את החשבון.
            </p>
          ) : (
            <form className="account-form" onSubmit={submit}>
              <label>
                אימייל
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
                סיסמה
                <input
                  dir="ltr"
                  minLength={6}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="לפחות 6 תווים"
                />
              </label>

              {authError && <p className="account-error">{authError}</p>}

              <button className="account-submit" disabled={submitting} type="submit">
                {submitting && <Loader size={16} />}
                {mode === "signIn" ? "התחברות" : "יצירת חשבון"}
              </button>

              {mode === "signUp" && (
                <p className="account-hint">
                  {referralCodeFromUrl
                    ? "הוזמנת דרך חבר — תקבל/י קרדיטים נוספים בהרשמה!"
                    : "נותנים 3 קרדיטים חינם להתחלה."}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
