"use client";

import { useEffect, useRef, useState } from "react";
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
  photo_url: string | null;
  share_token: string | null;
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

function PostcardControls({
  order,
  accessToken,
  onCreated,
}: {
  order: SongOrder;
  accessToken: string | undefined;
  onCreated: (shareToken: string, photoUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareLink = order.share_token && typeof window !== "undefined" ? `${window.location.origin}/postcard/${order.share_token}` : null;

  const copyLink = async () => {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!accessToken) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("orderId", order.id);
      formData.append("photo", file);

      const response = await fetch("/api/account/postcard", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "שגיאה ביצירת הגלויה");
        return;
      }

      onCreated(data.shareToken, data.photoUrl);
    } catch {
      setError("שגיאה ביצירת הגלויה");
    } finally {
      setUploading(false);
    }
  };

  if (!order.audioSignedUrl) {
    return null;
  }

  return (
    <div className="postcard-controls">
      <input
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadPhoto(file);
          }
          event.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      {shareLink ? (
        <div className="postcard-controls-link">
          <a href={shareLink} rel="noopener noreferrer" target="_blank">
            צפייה בגלויה
          </a>
          <button onClick={() => void copyLink()} type="button">
            {copied ? "הועתק!" : "העתקת קישור"}
          </button>
          <button disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
            {uploading ? <Loader size={14} /> : "החלפת תמונה"}
          </button>
        </div>
      ) : (
        <button className="postcard-create-btn" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
          {uploading && <Loader size={14} />}
          הוספת תמונה ושיתוף כגלויה
        </button>
      )}

      {error && <p className="billing-error">{error}</p>}
    </div>
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

  const applyPostcard = (orderId: string, shareToken: string, photoUrl: string) => {
    setOrders((current) =>
      current
        ? current.map((order) => (order.id === orderId ? { ...order, share_token: shareToken, photo_url: photoUrl } : order))
        : current,
    );
  };

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

                <PostcardControls
                  accessToken={accessToken}
                  onCreated={(shareToken, photoUrl) => applyPostcard(order.id, shareToken, photoUrl)}
                  order={order}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
