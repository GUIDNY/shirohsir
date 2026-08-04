"use client";

import { useEffect, useState } from "react";
import { Loader } from "./icons";
import { useAccount } from "./useAccount";

type SongOrder = {
  id: string;
  song_type: string;
  recipient: string;
  occasion: string;
  style: string;
  status: string;
  provider: string;
  prompt_preview: string;
  song_length_seconds: number;
  credits_cost: number;
  created_at: string;
  audioSignedUrl: string | null;
};

const songTypeLabels: Record<string, string> = {
  gift: "שיר מתנה",
  business: "שיר לעסק",
  graduation: "מסיבת סיום",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value),
  );
}

export function MySongsModal({ account, onClose }: { account: ReturnType<typeof useAccount>; onClose: () => void }) {
  const [orders, setOrders] = useState<SongOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessToken = account.session?.access_token;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    fetch("/api/account/orders", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("failed");
        }

        return response.json();
      })
      .then((data) => setOrders(data.orders))
      .catch(() => setError("לא הצלחנו לטעון את השירים שלך."));
  }, [accessToken]);

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal songs-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-header">
          <h3>השירים שלי</h3>
          <button aria-label="סגירה" className="billing-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {error && <p className="billing-error">{error}</p>}

        {!orders && !error && (
          <div className="songs-loading">
            <Loader size={20} />
            <span>טוען שירים...</span>
          </div>
        )}

        {orders && orders.length === 0 && <p className="songs-empty">עדיין לא הזמנת שיר.</p>}

        {orders && orders.length > 0 && (
          <div className="songs-list">
            {orders.map((order) => (
              <div className="song-card" key={order.id}>
                <div className="song-card-heading">
                  <div>
                    <strong>{order.recipient}</strong>
                    <span>
                      {songTypeLabels[order.song_type] || order.song_type} · {order.occasion}
                    </span>
                  </div>
                  <span className="song-card-date">{formatDate(order.created_at)}</span>
                </div>

                <p className="song-card-lyrics">{order.prompt_preview}</p>

                {order.audioSignedUrl ? (
                  <div className="song-card-audio">
                    <audio controls src={order.audioSignedUrl}>
                      הדפדפן שלך לא תומך בנגן אודיו.
                    </audio>
                    <a download href={order.audioSignedUrl}>
                      הורדה
                    </a>
                  </div>
                ) : (
                  <p className="song-card-pending">
                    {order.status === "lyrics_ready" ? "מילים בלבד — אין קובץ אודיו שמור" : "אודיו לא זמין"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
