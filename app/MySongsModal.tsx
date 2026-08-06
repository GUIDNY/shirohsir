"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXTRA_VERSION_CREDITS } from "@/lib/pricing-catalog";
import { Loader, Plus } from "./icons";
import { useAccount } from "./useAccount";

type SongVersionAudio = { label: string; audioSignedUrl: string | null };

type SongOrder = {
  id: string;
  song_type: string;
  recipient: string;
  occasion: string;
  style: string;
  status: string;
  mode: string;
  prompt_preview: string;
  song_length_seconds: number;
  credits_cost: number;
  photo_url: string | null;
  share_token: string | null;
  created_at: string;
  audioSignedUrl: string | null;
  versions: SongVersionAudio[];
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

function ExtraVersionButton({
  order,
  accessToken,
  onCreated,
  refreshCredits,
}: {
  order: SongOrder;
  accessToken: string | undefined;
  onCreated: (label: string) => void;
  refreshCredits: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestExtraVersion = async () => {
    if (!accessToken) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/extra-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "שגיאה ביצירת הגרסה הנוספת");
        return;
      }

      onCreated(data.version.label);
      refreshCredits();
    } catch {
      setError("שגיאה ביצירת הגרסה הנוספת");
    } finally {
      setPending(false);
    }
  };

  if (order.mode === "demo") {
    return null;
  }

  return (
    <div className="extra-version-row">
      <button className="postcard-create-btn" disabled={pending} onClick={() => void requestExtraVersion()} type="button">
        {pending ? <Loader size={14} /> : <Plus size={14} />}
        גרסה נוספת ({EXTRA_VERSION_CREDITS} קרדיטים)
      </button>
      {error && <p className="billing-error">{error}</p>}
    </div>
  );
}

export function MySongsModal({ account, onClose }: { account: ReturnType<typeof useAccount>; onClose: () => void }) {
  const [orders, setOrders] = useState<SongOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessToken = account.session?.access_token;

  const loadOrders = useCallback(() => {
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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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

                {order.versions.some((version) => version.audioSignedUrl) ? (
                  <div className="song-card-versions">
                    {order.versions.map((version, index) => (
                      <div className="song-card-audio" key={`${version.label}-${index}`}>
                        {version.label && order.versions.length > 1 && (
                          <span className="song-card-version-label">גרסה {version.label}</span>
                        )}
                        {version.audioSignedUrl && (
                          <>
                            <audio controls src={version.audioSignedUrl}>
                              הדפדפן שלך לא תומך בנגן אודיו.
                            </audio>
                            <a download href={version.audioSignedUrl}>
                              הורדה
                            </a>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="song-card-pending">
                    {order.status === "lyrics_ready" ? "מילים בלבד — אין קובץ אודיו שמור" : "אודיו לא זמין"}
                  </p>
                )}

                <ExtraVersionButton
                  accessToken={accessToken}
                  onCreated={() => loadOrders()}
                  order={order}
                  refreshCredits={() => void account.refreshCredits()}
                />

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
