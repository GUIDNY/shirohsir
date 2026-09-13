"use client";

import { useEffect, useState } from "react";
import { CREDITS_PER_SONG } from "@/lib/pricing-catalog";
import { Coin, Loader, Plus } from "./icons";
import { useAccount } from "./useAccount";

type HistoryEntry = {
  id: string;
  date: string;
  label: string;
  note: string;
  delta: number;
  balanceAfter: number;
};

function formatDate(value: string, locale: "he" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

// The wallet card ("הקרדיטים שלי") required by the pricing/credits spec:
// balance, how many songs that's worth, what's about to expire, and the
// two actions a customer needs from here — buy more, or go make a song.
export function CreditWalletModal({
  account,
  onClose,
  onBuyCredits,
  onNewSong,
  locale = "he",
}: {
  account: ReturnType<typeof useAccount>;
  onClose: () => void;
  onBuyCredits: () => void;
  onNewSong: () => void;
  // Optional locale override — defaults to Hebrew so every existing caller
  // (all of them, today) renders byte-identical to before this prop existed.
  locale?: "he" | "en";
}) {
  const { credits, session } = account;
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!historyOpen || history || !session?.access_token) {
      return;
    }

    fetch("/api/account/credit-history", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("failed");
        return response.json();
      })
      .then((data) => setHistory(data.history))
      .catch(() => setHistoryError(locale === "en" ? "We couldn’t load the history." : "לא הצלחנו לטעון את ההיסטוריה."));
  }, [historyOpen, history, session?.access_token, locale]);

  const balance = credits?.balance ?? 0;
  const songsAvailable = Math.floor(balance / CREDITS_PER_SONG);
  const leftover = balance % CREDITS_PER_SONG;

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal wallet-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-header">
          <h3>{locale === "en" ? "My Credits" : "הקרדיטים שלי"}</h3>
          <button aria-label={locale === "en" ? "Close" : "סגירה"} className="billing-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="wallet-balance-card">
          <span className="wallet-balance-icon">
            <Coin size={20} />
          </span>
          <div>
            <strong>{locale === "en" ? `You have ${balance} credits` : `יש לך ${balance} קרדיטים`}</strong>
            <span>
              {locale === "en"
                ? songsAvailable > 0
                  ? leftover > 0
                    ? `Enough for ${songsAvailable} full song${songsAvailable === 1 ? "" : "s"}, plus ${leftover} credit${leftover === 1 ? "" : "s"} left over`
                    : `Enough for ${songsAvailable} full song${songsAvailable === 1 ? "" : "s"}`
                  : "Not quite enough for a full song yet — you can add credits"
                : songsAvailable > 0
                  ? leftover > 0
                    ? `מספיק ל-${songsAvailable} שירים מלאים ועוד ${leftover} קרדיטים`
                    : `מספיק ל-${songsAvailable} שירים מלאים`
                  : "עדיין לא מספיק לשיר מלא — אפשר להוסיף קרדיטים"}
            </span>
          </div>
        </div>

        {credits?.expiringSoon && (
          <p className="wallet-expiry-note">
            {locale === "en"
              ? `${credits.expiringSoon.amount} credits will expire on ${formatDate(credits.expiringSoon.date, locale)}`
              : `${credits.expiringSoon.amount} קרדיטים יפוגו בתאריך ${formatDate(credits.expiringSoon.date, locale)}`}
          </p>
        )}

        <div className="wallet-actions">
          <button className="primary-button" onClick={onBuyCredits} type="button">
            {locale === "en" ? "Buy credits" : "רכישת קרדיטים"}
          </button>
          <button className="ghost-button" onClick={onNewSong} type="button">
            <Plus size={16} />
            {locale === "en" ? "Create a new song" : "יצירת שיר חדש"}
          </button>
        </div>

        <button className="wallet-history-toggle" onClick={() => setHistoryOpen((v) => !v)} type="button">
          {locale === "en"
            ? historyOpen
              ? "Hide transaction history"
              : "Show transaction history"
            : historyOpen
              ? "הסתרת היסטוריית פעולות"
              : "הצגת היסטוריית פעולות"}
        </button>

        {historyOpen && (
          <div className="wallet-history">
            {historyError && <p className="billing-error">{historyError}</p>}
            {!history && !historyError && (
              <div className="songs-loading">
                <Loader size={18} />
                <span>{locale === "en" ? "Loading history..." : "טוען היסטוריה..."}</span>
              </div>
            )}
            {history && history.length === 0 && (
              <p className="songs-empty">{locale === "en" ? "No credit transactions yet." : "עדיין אין פעולות קרדיטים."}</p>
            )}
            {history && history.length > 0 && (
              <ul className="wallet-history-list">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <div className="wallet-history-main">
                      <span className="wallet-history-label">{entry.label}</span>
                      <span className={entry.delta >= 0 ? "wallet-history-delta positive" : "wallet-history-delta negative"}>
                        {entry.delta >= 0 ? "+" : ""}
                        {entry.delta} {locale === "en" ? "credits" : "קרדיטים"}
                      </span>
                    </div>
                    <div className="wallet-history-meta">
                      <span>{formatDate(entry.date, locale)}</span>
                      <span>{locale === "en" ? `Balance after: ${entry.balanceAfter}` : `יתרה לאחר הפעולה: ${entry.balanceAfter}`}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
