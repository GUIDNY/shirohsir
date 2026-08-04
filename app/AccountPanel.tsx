"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "./useAccount";
import { Loader } from "./icons";

type Mode = "signIn" | "signUp";

export function AccountPanel({ account }: { account: ReturnType<typeof useAccount> }) {
  const { session, user, authLoading, authError, credits, creditsLoading, signUp, signIn, signOut } = account;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

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
      const { needsEmailConfirmation } = await signUp(email, password);
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
            {creditsLoading ? "…" : `${credits?.balance ?? 0} קרדיטים`}
          </span>
        </div>
        <button className="account-signout" type="button" onClick={() => void signOut()}>
          התנתקות
        </button>
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

              {mode === "signUp" && <p className="account-hint">נותנים 3 קרדיטים חינם להתחלה.</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
