"use client";

import { Fragment, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  CheckSmall,
  ChevronDown,
  Coin,
  Copy,
  Edit,
  Gift,
  GraduationCap,
  Loader,
  Lock,
  Lyrics,
  Mic,
  MusicNote,
  PlayCircle,
  Refresh,
  Storefront,
} from "./icons";
import { BillingModal } from "./BillingModal";
import { promptSignIn } from "./promptSignIn";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import {
  CREDITS_PER_SONG,
  DEFAULT_SONG_LENGTH_SECONDS,
  PricingPlan,
  singleSongPlan,
  SONG_LENGTH_OPTIONS,
} from "@/lib/pricing-catalog";
import { useAccount } from "./useAccount";

type SongType = "gift" | "business" | "graduation";
type OrderStatus = "idle" | "sending" | "ready" | "error";

type LyricsMode = "auto" | "custom";

// "תפתיעו אותי" (default) / "יש לי השראה" (free-text style reference) /
// "יש לי הקלטה להשראה" (uploaded/recorded audio reference — musical
// inspiration only, never framed as melody preservation) — independent
// of LyricsMode, since who writes the words and how the music is
// directed are separate choices.
type MusicMode = "auto" | "inspiration" | "reference";
type MelodyUploadStatus = "idle" | "uploading" | "ready" | "error";

type OrderPayload = {
  songType: SongType;
  recipient: string;
  occasionChip: string;
  occasionCustom: string;
  lyricsMode: LyricsMode;
  story: string;
  mustInclude: string;
  customLyrics: string;
  moods: string[];
  musicMode: MusicMode;
  inspiration: string;
  // Set once /api/orders/upload-melody returns an ElevenLabs song_id —
  // that id (not the raw audio) is what's sent with the order.
  melodySongId: string | null;
  melodyFileName: string;
  melodyRightsConfirmed: boolean;
  avoid: string;
  customerName: string;
  email: string;
  phone: string;
  consent: boolean;
  songLengthSeconds: number;
  recipientGender: "male" | "female" | null;
};

type SongVersion = {
  label: string;
  provider: string;
  status: string;
  mode: "demo" | "live";
  promptPreview: string;
  audioDataUrl?: string;
  audioContentType?: string;
  downloadFileName?: string;
};

type ApiResult = {
  orderId: string;
  mode: "demo" | "full";
  promptPreview: string;
  versions: SongVersion[];
};

// Admin-only operational data (the real music-provider quota) — never
// rendered for a regular customer, see the `isAdmin`-gated block below.
type ProviderQuotaInfo = {
  mode: "demo" | "live";
  status: string;
  tier?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  percentUsed?: number;
  overageDisabled?: boolean;
  nextReset?: string | null;
};

// Customer-facing labels only — the underlying value ("gift" | "business" |
// "graduation") is the real field sent to the server and must not change.
const songTypes: Array<{
  id: SongType;
  label: string;
  description: string;
  icon: typeof Gift;
}> = [
  {
    id: "gift",
    label: "שיר מתנה",
    description: "ליום הולדת, זוגיות, חתונה, גיוס או הפתעה מרגשת.",
    icon: Gift,
  },
  {
    id: "business",
    label: "שיר לעסק",
    description: "לפרסום, אירוע, קמפיין, פתיח או תוכן לרשתות.",
    icon: Storefront,
  },
  {
    id: "graduation",
    label: "שיר למסיבה או אירוע",
    description: "לגן, בית ספר, צוות, מסיבת סיום או חגיגה משפחתית.",
    icon: GraduationCap,
  },
];

const initialOrder: OrderPayload = {
  songType: "gift",
  recipient: "",
  occasionChip: "",
  occasionCustom: "",
  lyricsMode: "auto",
  story: "",
  mustInclude: "",
  customLyrics: "",
  moods: [],
  musicMode: "auto",
  melodySongId: null,
  melodyFileName: "",
  melodyRightsConfirmed: false,
  inspiration: "",
  avoid: "",
  customerName: "",
  email: "",
  phone: "",
  consent: false,
  songLengthSeconds: DEFAULT_SONG_LENGTH_SECONDS,
  recipientGender: null,
};

const OCCASION_CHIPS = ["יום הולדת", "חתונה", "זוגיות", "משפחה", "חבר/ה", "פרידה", "עסק", "אחר"];

const MOOD_CHIPS: Array<{ id: string; label: string; emoji: string }> = [
  { id: "מרגש", label: "מרגש", emoji: "❤️" },
  { id: "מצחיק", label: "מצחיק", emoji: "😂" },
  { id: "רומנטי", label: "רומנטי", emoji: "🥰" },
  { id: "שמח", label: "שמח", emoji: "🎉" },
  { id: "קצבי", label: "קצבי", emoji: "😎" },
];

const MAX_MOODS = 2;

function resolveOccasion(order: OrderPayload) {
  return order.occasionChip === "אחר" ? order.occasionCustom.trim() : order.occasionChip;
}

// Drives both the client pre-submit check and which step to send the
// customer back to if something's missing — recipient/occasion/story live
// in step 1, contact details now live in step 3 (see spec: don't ask for
// contact info while the customer is still telling the story).
function getMissingFieldInfo(order: OrderPayload): { label: string; step: number } | null {
  if (!order.recipient.trim()) {
    return { label: "למי מכינים את השיר", step: 1 };
  }

  if (!order.recipientGender) {
    return { label: "האם מדובר בגבר או באישה", step: 1 };
  }

  if (!order.occasionChip) {
    return { label: "סוג האירוע", step: 1 };
  }

  if (order.occasionChip === "אחר" && !order.occasionCustom.trim()) {
    return { label: "פירוט האירוע", step: 1 };
  }

  if (order.lyricsMode === "custom" ? !order.customLyrics.trim() : !order.story.trim()) {
    return { label: order.lyricsMode === "custom" ? "מילות השיר" : "הסיפור", step: 1 };
  }

  if (order.musicMode === "reference") {
    if (!order.melodySongId) {
      return { label: "הקלטה", step: 1 };
    }

    if (!order.melodyRightsConfirmed) {
      return { label: "אישור זכויות על ההקלטה", step: 1 };
    }
  }

  if (!order.customerName.trim()) {
    return { label: "השם שלך", step: 3 };
  }

  if (!order.email.trim()) {
    return { label: "אימייל", step: 3 };
  }

  if (!order.phone.trim()) {
    return { label: "טלפון", step: 3 };
  }

  return null;
}

function buildConfirmationSummary(order: OrderPayload) {
  const occasion = resolveOccasion(order) || "האירוע שסיפרתם עליו";
  const recipient = order.recipient.trim() || "מי שבחרתם";
  const sentences = [
    `השיר הוא ל${recipient}, לרגל ${occasion}.`,
    order.lyricsMode === "custom"
      ? "נפיק את השיר בדיוק לפי המילים שכתבתם."
      : "קראנו את הסיפור ששיתפתם ונשלב אותו במילות השיר.",
  ];

  const useInspiration = order.musicMode === "inspiration" && order.inspiration.trim();

  if (order.moods.length > 0) {
    const moodsText = order.moods.join(" ו");
    sentences.push(
      useInspiration
        ? `נכין שיר שמרגיש ${moodsText}, בהשראת הסגנון של ${order.inspiration.trim()}.`
        : `נכין שיר שמרגיש ${moodsText}.`,
    );
  } else if (useInspiration) {
    sentences.push(`נכין שיר בהשראת הסגנון של ${order.inspiration.trim()}.`);
  }

  if (order.musicMode === "reference") {
    sentences.push("שירלי תשתמש בהקלטה שהעליתם כהשראה לאווירה, לקצב ולסגנון של השיר — לא כשכפול של הלחן.");
  }

  return sentences.join(" ");
}

const processSteps = [
  { title: "בוחרים סוג שיר", detail: "יום הולדת, חתונה, זוגיות, עסק או כל אירוע אחר." },
  { title: "מספרים את הסיפור", detail: "מוסיפים שמות, זיכרונות, בדיחות ורגעים מיוחדים." },
  { title: "מאשרים את המילים", detail: "עוברים על מה שהבנו ומאשרים לפני ההפקה." },
  { title: "מורידים את השיר", detail: "הגרסאות המוכנות זמינות באזור האישי להורדה ולשיתוף." },
];

const allowedRules = [
  {
    icon: Lyrics,
    title: "סיפור אישי",
    detail: "אפשר להשתמש בשמות, זיכרונות, בדיחות ורגעים מיוחדים.",
  },
  {
    icon: MusicNote,
    title: "סגנון מוזיקלי לבחירה",
    detail: "אפשר לבקש שיר שמח, מרגש, קצבי, רגוע או חגיגי.",
  },
  {
    icon: Edit,
    title: "תיקונים במילים",
    detail: "לפני הפקת השיר תוכלו לעבור על הטקסט ולבקש התאמות.",
  },
];

const blockedRules = [
  {
    icon: Copy,
    title: "העתקה של שירים קיימים",
    detail: "לא ניתן להשתמש במילים או במנגינה של שיר מוגן.",
  },
  {
    icon: Mic,
    title: "חיקוי מדויק של זמר",
    detail: "אפשר לבחור סגנון כללי, אך לא לחקות באופן מדויק קול של אדם אמיתי.",
  },
  {
    icon: AlertTriangle,
    title: "תוכן פוגעני או ללא הסכמה",
    detail: "לא ניתן ליצור תוכן שמבזה אדם אחר או משתמש בפרטיו באופן לא ראוי.",
  },
  {
    icon: Lock,
    title: "הבטחת הצלחה מסחרית",
    detail: "לא ניתן להבטיח ששיר יצליח, יתפרסם או יניב הכנסות.",
  },
];

const numberFormatter = new Intl.NumberFormat("he-IL");

function formatNumber(value: number | undefined) {
  return typeof value === "number" ? numberFormatter.format(value) : "—";
}

function formatCompact(value: number | undefined) {
  if (typeof value !== "number") {
    return "—";
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }

  return numberFormatter.format(value);
}

function formatReset(value: string | null | undefined) {
  if (!value) {
    return "לא ידוע";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const account = useAccount();
  const [step, setStep] = useState(0);
  // Gates the whole order-tool behind the two upfront decisions ("מה לגבי
  // המילים?" / "מה לגבי המנגינה?") — order.lyricsMode/musicMode already
  // drive every downstream question, this just makes the choice the
  // very first thing a customer sees instead of a toggle buried in step 1.
  const [decisionMade, setDecisionMade] = useState(false);
  const [showInspirationField, setShowInspirationField] = useState(false);
  const [order, setOrder] = useState<OrderPayload>(initialOrder);
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [summaryOpenMobile, setSummaryOpenMobile] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [orderMode, setOrderMode] = useState<"demo" | "full">("full");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlan | null>(null);
  const [providerQuota, setProviderQuota] = useState<ProviderQuotaInfo | null>(null);
  const [providerQuotaStatus, setProviderQuotaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lyricsPreview, setLyricsPreview] = useState<string | null>(null);
  const [lyricsPreviewError, setLyricsPreviewError] = useState(false);
  const [melodyUploadStatus, setMelodyUploadStatus] = useState<MelodyUploadStatus>("idle");
  const [melodyError, setMelodyError] = useState<string | null>(null);
  const [melodyPreviewUrl, setMelodyPreviewUrl] = useState<string | null>(null);
  const [isRecordingMelody, setIsRecordingMelody] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const melodyFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const isAdmin = account.credits?.isAdmin === true;
  const isLiveProviderQuota = providerQuotaStatus === "ready" && providerQuota?.mode === "live";
  const accessToken = account.session?.access_token;
  const creditBalance = account.credits?.balance ?? 0;
  const hasEnoughCredits = isAdmin || creditBalance >= CREDITS_PER_SONG;
  const freeDemoUsed = account.credits?.freeDemoUsed === true;

  const goToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearMelody = useCallback(() => {
    setMelodyPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setMelodyUploadStatus("idle");
    setMelodyError(null);

    if (melodyFileInputRef.current) {
      melodyFileInputRef.current.value = "";
    }
  }, []);

  const startNewOrder = useCallback(() => {
    setOrder(initialOrder);
    setStep(0);
    setStatus("idle");
    setOrderError(null);
    setResult(null);
    setOrderMode("full");
    setAdvancedOpen(false);
    setIdempotencyKey(crypto.randomUUID());
    setDecisionMade(false);
    setShowInspirationField(false);
    clearMelody();
  }, [clearMelody]);

  // Revoke the object URL used for melody preview playback on unmount
  // so it doesn't leak.
  useEffect(() => {
    return () => {
      if (melodyPreviewUrl) {
        URL.revokeObjectURL(melodyPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadMelodyFile = useCallback(
    async (blob: Blob, fileName: string) => {
      if (!account.session) {
        promptSignIn();
        return;
      }

      setMelodyPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return URL.createObjectURL(blob);
      });
      setOrder((current) => ({ ...current, melodyFileName: fileName, melodySongId: null, melodyRightsConfirmed: false }));
      setMelodyUploadStatus("uploading");
      setMelodyError(null);

      try {
        const formData = new FormData();
        formData.append("file", blob, fileName);

        const response = await fetch("/api/orders/upload-melody", {
          method: "POST",
          headers: { Authorization: `Bearer ${account.session.access_token}` },
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as { songId?: string; error?: string } | null;

        if (!response.ok || !data?.songId) {
          throw new Error(data?.error || "שגיאה בהעלאת ההקלטה");
        }

        setOrder((current) => ({ ...current, melodySongId: data.songId as string }));
        setMelodyUploadStatus("ready");
      } catch (err) {
        setMelodyUploadStatus("error");
        setMelodyError(err instanceof Error ? err.message : "שגיאה בהעלאת ההקלטה");
      }
    },
    [account.session],
  );

  const handleMelodyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the exact same file again after a failed upload
    // still fires a change event — browsers don't fire one when an
    // <input type="file"> is set to the same value it already has.
    event.target.value = "";

    if (file) {
      void uploadMelodyFile(file, file.name);
    }
  };

  // Auto-stops well past ElevenLabs' ~30s reference guidance so a
  // customer can't accidentally record an oversized file.
  const MAX_RECORDING_SECONDS = 40;

  const stopRecordingMelody = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecordingMelody(false);

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const startRecordingMelody = async () => {
    if (!account.session) {
      promptSignIn();
      return;
    }

    setMelodyError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void uploadMelodyFile(blob, `הקלטה-${Date.now()}.webm`);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMelody(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds + 1 >= MAX_RECORDING_SECONDS) {
            stopRecordingMelody();
          }

          return seconds + 1;
        });
      }, 1000);
    } catch {
      setMelodyError("לא הצלחנו לגשת למיקרופון — אפשר להעלות קובץ במקום.");
    }
  };

  const removeMelody = () => {
    clearMelody();
    setOrder((current) => ({ ...current, melodySongId: null, melodyFileName: "", melodyRightsConfirmed: false }));
  };

  const handleSelectPlan = (plan: PricingPlan) => {
    if (!account.session) {
      promptSignIn();
      return;
    }

    setCheckoutPlan(plan);
  };

  const handleStartDemo = () => {
    if (!account.session) {
      promptSignIn();
      return;
    }

    if (freeDemoUsed && !isAdmin) {
      return;
    }

    setOrder(initialOrder);
    setOrderMode("demo");
    setStep(0);
    setStatus("idle");
    setOrderError(null);
    setResult(null);
    setAdvancedOpen(false);
    goToSection("order");
  };

  // Admin-only operational view — never fetched or rendered for a regular
  // customer. See app/api/credits/route.ts, which 403s for non-admins too.
  const refreshProviderQuota = useCallback(async () => {
    if (!isAdmin || !accessToken) {
      return;
    }

    try {
      const response = await fetch("/api/credits", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Provider quota request failed");
      }

      const data = (await response.json()) as ProviderQuotaInfo;
      setProviderQuota(data);
      setProviderQuotaStatus("ready");
    } catch {
      setProviderQuotaStatus("error");
    }
  }, [isAdmin, accessToken]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const initial = window.setTimeout(() => void refreshProviderQuota(), 0);
    const interval = window.setInterval(() => void refreshProviderQuota(), 30000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [isAdmin, refreshProviderQuota]);

  const selectedType = songTypes.find((item) => item.id === order.songType) ?? songTypes[0];
  const resolvedOccasion = resolveOccasion(order);
  const canPreviewLyrics = Boolean(
    order.recipient.trim() &&
      resolvedOccasion &&
      order.recipientGender &&
      (order.lyricsMode === "custom" ? order.customLyrics.trim() : order.story.trim()),
  );
  const displayLyricsPreview = order.lyricsMode === "custom" ? order.customLyrics : lyricsPreview;

  // Fetch the real generated lyrics (not just a summary sentence) whenever
  // the customer reaches the confirm step, so they can catch a mistake
  // before the paid step actually spends credits and calls ElevenLabs.
  // getHebrewLyrics() calls Gemini (a real, quota'd API), so debounce
  // this instead of firing on every keystroke while editing on step 2.
  useEffect(() => {
    if (step !== 2 || !accessToken || !canPreviewLyrics || order.lyricsMode === "custom") {
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      fetch("/api/orders/preview-lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          songType: order.songType,
          recipient: order.recipient,
          occasion: resolvedOccasion,
          moods: order.moods,
          inspiration: order.inspiration,
          story: order.story,
          mustInclude: order.mustInclude,
          avoid: order.avoid,
          recipientGender: order.recipientGender,
          songLengthSeconds: order.songLengthSeconds,
        }),
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(response)))
        .then((data: { lyrics: string }) => {
          if (!cancelled) {
            setLyricsPreview(data.lyrics);
            setLyricsPreviewError(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLyricsPreviewError(true);
          }
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    step,
    accessToken,
    canPreviewLyrics,
    order.lyricsMode,
    order.songType,
    order.recipient,
    resolvedOccasion,
    order.moods,
    order.inspiration,
    order.story,
    order.mustInclude,
    order.avoid,
    order.recipientGender,
    order.songLengthSeconds,
  ]);
  const completion = useMemo(() => {
    const lyricsValue = order.lyricsMode === "custom" ? order.customLyrics : order.story;
    const required = [order.recipient, resolveOccasion(order), lyricsValue, order.customerName, order.email, order.phone];
    const filled = required.filter((value) => value.trim().length > 0).length;
    return Math.round((filled / required.length) * 100);
  }, [order]);

  // Drives both the order form's own step tabs and the marketing process
  // band above it — real state, not a fixed/decorative indicator: the
  // form's step (0/1/2/3) maps directly to the 4 marketing process steps,
  // and a delivered result bumps it to the final "מורידים את השיר" step.
  const activeProcessIndex = result ? 3 : step;

  const setField = <K extends keyof OrderPayload>(key: K, value: OrderPayload[K]) => {
    setOrder((current) => ({ ...current, [key]: value }));
  };

  const selectOccasion = (chip: string) => {
    setOrder((current) => ({
      ...current,
      occasionChip: chip,
      occasionCustom: chip === "אחר" ? current.occasionCustom : "",
    }));
  };

  const toggleMood = (moodId: string) => {
    setOrder((current) => {
      if (current.moods.includes(moodId)) {
        return { ...current, moods: current.moods.filter((mood) => mood !== moodId) };
      }

      if (current.moods.length >= MAX_MOODS) {
        return { ...current, moods: [...current.moods.slice(1), moodId] };
      }

      return { ...current, moods: [...current.moods, moodId] };
    });
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setOrderError(null);

    if (!account.session) {
      promptSignIn();
      return;
    }

    const missingField = getMissingFieldInfo(order);

    if (missingField) {
      setStep(missingField.step);
      setOrderError(`חסר פרט: "${missingField.label}".`);
      setStatus("error");
      return;
    }

    if (orderMode === "full" && !hasEnoughCredits) {
      // The insufficient-credits panel below the summary already covers
      // this case — this is just a defensive guard against a stale
      // balance if credits changed in another tab.
      setOrderError("חסרים לך קרדיטים להפקת השיר");
      setStatus("error");
      return;
    }

    setStatus("sending");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.session.access_token}`,
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify({
          songType: order.songType,
          recipient: order.recipient,
          occasion: resolveOccasion(order),
          moods: order.moods,
          musicMode: order.musicMode,
          inspiration: order.inspiration,
          audioReference: order.musicMode === "reference" && order.melodySongId ? { songId: order.melodySongId, conditionStrength: "high" } : undefined,
          melodyRightsConfirmed: order.melodyRightsConfirmed,
          story: order.story,
          mustInclude: order.mustInclude,
          customLyrics: order.customLyrics,
          avoid: order.avoid,
          customerName: order.customerName,
          email: order.email,
          phone: order.phone,
          consent: order.consent,
          mode: orderMode,
          idempotencyKey,
          songLengthSeconds: order.songLengthSeconds,
          recipientGender: order.recipientGender,
        }),
      });

      if (response.status === 409) {
        setOrderError("כבר יצרתם את הדמו החינמי שלכם — אפשר לרכוש שיר מלא.");
        setStatus("error");
        void account.refreshCredits();
        return;
      }

      if (response.status === 402) {
        setOrderError("חסרים לך קרדיטים להפקת השיר");
        setStatus("error");
        void account.refreshCredits();
        return;
      }

      if (response.status === 400) {
        setStep(1);
        setOrderError('חסרים פרטים בטופס — אפשר לעבור על שלב "מספרים את הסיפור" ולוודא שהכול מלא.');
        setStatus("error");
        return;
      }

      if (response.status === 502) {
        const data = await response.json().catch(() => null);
        setOrderError(data?.error || "תקלה זמנית בהפקת השיר — הקרדיטים הוחזרו לחשבון שלך. אפשר לנסות שוב.");
        setStatus("error");
        void account.refreshCredits();
        return;
      }

      if (!response.ok) {
        throw new Error("Order request failed");
      }

      const data = (await response.json()) as ApiResult;
      setResult(data);
      setStatus("ready");
      setStep(3);
      setIdempotencyKey(crypto.randomUUID());
      void account.refreshCredits();
      void refreshProviderQuota();
    } catch {
      setOrderError("לא הצלחנו להשלים את הפעולה כרגע. אפשר לנסות שוב בעוד מספר דקות.");
      setStatus("error");
    }
  };

  return (
    <main className="site-shell" dir="rtl">
      <SiteHeader
        account={account}
        homeHref="#top"
        navLinks={[
          { href: "#how", label: "איך זה עובד" },
          { href: "/pricing", label: "מחירים" },
          { href: "#legal", label: "מה מותר" },
        ]}
        onNewSong={() => {
          startNewOrder();
          goToSection("order");
        }}
        adminSlot={
          isAdmin ? (
            <div className="admin-quota-pill" title="מסך ניהול — מלאי ספק המוזיקה">
              <Coin size={15} className="coin-icon" />
              <strong>
                {providerQuotaStatus === "loading"
                  ? "בודק..."
                  : providerQuotaStatus === "error"
                    ? "לא זמין"
                    : formatNumber(providerQuota?.remaining)}
              </strong>
              <button type="button" onClick={refreshProviderQuota} aria-label="רענון">
                <Refresh size={12} />
              </button>
            </div>
          ) : undefined
        }
      />

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <h1>הופכים את הסיפור שלכם לשיר אישי.</h1>
          <p className="hero-text">
            ספרו למערכת על האדם, האירוע והרגעים החשובים. המערכת כותבת, מלחינה ומפיקה שיר מקורי אוטומטית
            תוך דקות, מוכן לשיתוף ולהורדה.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#order">
              <PlayCircle size={20} />
              מתחילים ליצור שיר
            </a>
            <a className="secondary-link" href="#how">
              איך זה עובד?
            </a>
          </div>
          <dl className="trust-strip" aria-label="למה לבחור בנו">
            <div>
              <dt>שתי גרסאות לבחירה</dt>
              <dd>תקבלו שתי גרסאות שונות ותבחרו את זו שאתם הכי אוהבים.</dd>
            </div>
            <div>
              <dt>מוכן לשיתוף ולהורדה</dt>
              <dd>קובץ שמע איכותי שאפשר לשלוח למשפחה ולחברים.</dd>
            </div>
          </dl>
        </div>

        <div className="studio-visual" aria-label="תצוגת שיר">
          <div className="player-card">
            <div className="player-card-top">
              <span className="player-card-brand font-wordmark" dir="ltr">
                Shirli
              </span>
              <span className="player-card-badge">PREMIUM</span>
            </div>

            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 28 }).map((_, index) => (
                <span className="waveform-bar" key={index} style={{ "--i": index } as React.CSSProperties} />
              ))}
            </div>

            <button className="player-card-play" type="button" aria-label="נגן דוגמת שיר">
              <PlayCircle size={26} strokeWidth={1.6} />
            </button>

            <div className="player-card-bottom">
              <div>
                <strong className="cover-title">השיר של נועה</strong>
                <span className="cover-subtitle">פופ ישראלי</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="demo-hook-section">
        <div className="demo-hook-card">
          <span className="demo-hook-icon">
            <PlayCircle size={22} />
          </span>
          <div className="demo-hook-copy">
            <h2>שומעים לפני שמשלמים</h2>
            <p>ספרו לנו כמה פרטים וקבלו דמו אישי של 20 שניות, ללא תשלום וללא התחייבות.</p>
          </div>
          <div className="demo-hook-actions">
            <button className="primary-button" disabled={freeDemoUsed && !isAdmin} onClick={handleStartDemo} type="button">
              <PlayCircle size={18} />
              {freeDemoUsed && !isAdmin ? "כבר יצרתם את הדמו החינמי" : "יצירת דמו חינם"}
            </button>
            <span className="demo-hook-hint">אין צורך בכרטיס אשראי</span>
          </div>
        </div>
      </section>

      <section id="order" className="order-section">
        <div className="section-intro">
          <p className="eyebrow">התהליך שלנו</p>
          <h2>
            כל מה שצריך כדי
            <br />
            <span className="accent-text-alt">להפוך סיפור לשיר.</span>
          </h2>
          <p>ממלאים כמה פרטים, מאשרים את המילים לפני ההפקה, ומקבלים שיר מוכן להורדה ולשיתוף.</p>
        </div>

        <form className="order-tool" onSubmit={submitOrder}>
          {!decisionMade ? (
            <div className="form-panel decision-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <Edit size={18} />
                </span>
                <div>
                  <h3>בואו נתחיל</h3>
                  <p>שתי שאלות קצרות, ונבנה בדיוק את התהליך שמתאים לכם.</p>
                </div>
              </div>

              <div className="decision-question">
                <span className="story-field-label">מה לגבי המילים?</span>
                <div className="decision-grid">
                  <label className={order.lyricsMode === "custom" ? "type-card selected" : "type-card"}>
                    <input
                      checked={order.lyricsMode === "custom"}
                      name="lyricsDecision"
                      onChange={() => setField("lyricsMode", "custom")}
                      type="radio"
                    />
                    {order.lyricsMode === "custom" && (
                      <span className="type-card-check">
                        <CheckSmall size={13} />
                      </span>
                    )}
                    <span className="type-card-icon">
                      <Edit size={22} />
                    </span>
                    <strong>יש לי מילים</strong>
                    <span>כבר כתבתי את המילים לשיר</span>
                  </label>
                  <label className={order.lyricsMode === "auto" ? "type-card selected" : "type-card"}>
                    <input
                      checked={order.lyricsMode === "auto"}
                      name="lyricsDecision"
                      onChange={() => setField("lyricsMode", "auto")}
                      type="radio"
                    />
                    {order.lyricsMode === "auto" && (
                      <span className="type-card-check">
                        <CheckSmall size={13} />
                      </span>
                    )}
                    <span className="type-card-icon">
                      <Lyrics size={22} />
                    </span>
                    <strong>אני רוצה שהמערכת תכתוב לי</strong>
                    <span>אני אספר על השיר ואנחנו נכתוב את המילים</span>
                  </label>
                </div>
              </div>

              <div className="decision-question">
                <span className="story-field-label">מה לגבי המנגינה?</span>
                <div className="decision-grid">
                  <label className={order.musicMode === "reference" ? "type-card selected" : "type-card"}>
                    <input
                      checked={order.musicMode === "reference"}
                      name="musicDecision"
                      onChange={() => setField("musicMode", "reference")}
                      type="radio"
                    />
                    {order.musicMode === "reference" && (
                      <span className="type-card-check">
                        <CheckSmall size={13} />
                      </span>
                    )}
                    <span className="type-card-icon">
                      <Mic size={22} />
                    </span>
                    <strong>יש לי הקלטה להשראה</strong>
                    <span>אקליט, אזמזם, אשיר או אעלה קובץ</span>
                  </label>
                  <label className={order.musicMode !== "reference" ? "type-card selected" : "type-card"}>
                    <input
                      checked={order.musicMode !== "reference"}
                      name="musicDecision"
                      onChange={() => setField("musicMode", "auto")}
                      type="radio"
                    />
                    {order.musicMode !== "reference" && (
                      <span className="type-card-check">
                        <CheckSmall size={13} />
                      </span>
                    )}
                    <span className="type-card-icon">
                      <MusicNote size={22} />
                    </span>
                    <strong>אני רוצה שהמערכת תיצור לי</strong>
                    <span>המערכת תיצור לחן והפקה לשיר</span>
                  </label>
                </div>
              </div>

              <button className="primary-button" onClick={() => setDecisionMade(true)} type="button">
                בואו נתחיל
                <ArrowLeft size={18} />
              </button>
            </div>
          ) : (
            <>
          <div className="steps" aria-label="התקדמות ביצירת השיר">
            {["סוג שיר", order.lyricsMode === "custom" ? "המילים" : "הסיפור", "אימות", "סיכום"].map((label, index, all) => (
              <Fragment key={label}>
                <button
                  className={step === index ? "active" : step > index ? "done" : ""}
                  type="button"
                  onClick={() => setStep(index)}
                >
                  <span className="step-badge">{step > index ? <CheckSmall size={13} /> : index + 1}</span>
                  <span className="step-label">{label}</span>
                </button>
                {index < all.length - 1 && <span className="step-connector" aria-hidden="true" />}
              </Fragment>
            ))}
          </div>

          {status === "error" && orderError && (
            <p className="status-message error form-level-error">{orderError}</p>
          )}

          {step === 0 && (
            <div className="form-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <MusicNote size={18} />
                </span>
                <div>
                  <h3>איזה רגע הופכים לשיר?</h3>
                  <p>בחרו את הסוג שהכי מתאים לרגע שלכם.</p>
                </div>
              </div>
              <div className="type-grid">
                {songTypes.map((type) => (
                  <label className={order.songType === type.id ? "type-card selected" : "type-card"} key={type.id}>
                    <input
                      checked={order.songType === type.id}
                      name="songType"
                      onChange={() => setField("songType", type.id)}
                      type="radio"
                    />
                    {order.songType === type.id && (
                      <span className="type-card-check">
                        <CheckSmall size={13} />
                      </span>
                    )}
                    <span className="type-card-icon">
                      <type.icon size={22} />
                    </span>
                    <strong>{type.label}</strong>
                    <span>{type.description}</span>
                  </label>
                ))}
              </div>

              {orderMode === "full" && (
                <div className="length-picker">
                  <span className="length-picker-label">משך השיר</span>
                  <div className="length-grid">
                    {SONG_LENGTH_OPTIONS.map((option) => (
                      <label
                        className={order.songLengthSeconds === option.seconds ? "length-card selected" : "length-card"}
                        key={option.seconds}
                      >
                        <input
                          checked={order.songLengthSeconds === option.seconds}
                          name="songLengthSeconds"
                          onChange={() => setField("songLengthSeconds", option.seconds)}
                          type="radio"
                        />
                        <strong>{option.label}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {orderMode === "demo" && (
                <p className="demo-mode-note">
                  <PlayCircle size={15} />
                  יוצרים דמו חינם של 20 שניות — בלי תשלום ובלי התחייבות.
                </p>
              )}

              <button className="primary-button" type="button" onClick={() => setStep(1)}>
                ממשיכים לסיפור
                <ArrowLeft size={18} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="form-panel story-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <Edit size={18} />
                </span>
                <div>
                  <h3>למי מכינים את השיר?</h3>
                  <p>כמה פרטים קטנים, והמערכת כבר תהפוך אותם לשיר.</p>
                </div>
              </div>

              <label className="story-field">
                <span className="story-field-label">למי מכינים את השיר?</span>
                <input
                  required
                  value={order.recipient}
                  onChange={(event) => setField("recipient", event.target.value)}
                  placeholder="לדוגמה: נועה, החברה שלי"
                />
              </label>

              <div className="chip-field">
                <span className="story-field-label">{order.recipient.trim() || "מי שהשיר בשבילו"} זה...</span>
                <div className="occasion-chips">
                  <button
                    className={order.recipientGender === "male" ? "occasion-chip selected" : "occasion-chip"}
                    onClick={() => setField("recipientGender", "male")}
                    type="button"
                  >
                    הוא
                  </button>
                  <button
                    className={order.recipientGender === "female" ? "occasion-chip selected" : "occasion-chip"}
                    onClick={() => setField("recipientGender", "female")}
                    type="button"
                  >
                    היא
                  </button>
                </div>
                <span className="story-field-hint">כדי שהמילים בשיר יתאימו נכון מבחינה דקדוקית.</span>
              </div>

              <div className="chip-field">
                <span className="story-field-label">מה חוגגים?</span>
                <div className="occasion-chips">
                  {OCCASION_CHIPS.map((chip) => (
                    <button
                      className={order.occasionChip === chip ? "occasion-chip selected" : "occasion-chip"}
                      key={chip}
                      onClick={() => selectOccasion(chip)}
                      type="button"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {order.occasionChip === "אחר" && (
                  <input
                    className="occasion-other-input"
                    onChange={(event) => setField("occasionCustom", event.target.value)}
                    placeholder="איזה אירוע?"
                    value={order.occasionCustom}
                  />
                )}
              </div>

              {order.lyricsMode === "auto" ? (
                <>
                  <label className="story-field story-field--main">
                    <span className="story-field-label">
                      ספרו לנו קצת על {order.recipient.trim() || "האדם שהשיר בשבילו"}
                    </span>
                    <textarea
                      className="story-textarea"
                      required
                      value={order.story}
                      onChange={(event) => setField("story", event.target.value)}
                      placeholder={
                        "איך הכרתם? מה אתם אוהבים לעשות יחד? משהו מצחיק שקרה? רגע שלא תשכחו? כינוי מיוחד? פרטים שמאפיינים אותו או אותה?\n\nלא צריך לנסח יפה, פשוט תספרו לנו. המערכת כבר תהפוך את זה לשיר."
                      }
                    />
                    <span className="story-field-hint">ככל שתספרו יותר, השיר ירגיש יותר אישי.</span>
                  </label>

                  <label className="story-field">
                    <span className="story-field-label">יש משהו שחייב להופיע בשיר?</span>
                    <input
                      onChange={(event) => setField("mustInclude", event.target.value)}
                      placeholder="למשל: הכינוי 'במבה', הטיול ליוון, המשפט שהוא תמיד אומר..."
                      value={order.mustInclude}
                    />
                  </label>
                </>
              ) : (
                <label className="story-field story-field--main">
                  <span className="story-field-label">הדביקו כאן את מילות השיר המלאות</span>
                  <textarea
                    className="story-textarea"
                    required
                    value={order.customLyrics}
                    onChange={(event) => setField("customLyrics", event.target.value)}
                    placeholder={
                      "אפשר לכתוב את כל מילות השיר כמו שהן.\n\nאם נוח לכם, אפשר לסמן קטעים עם [Verse] ו-[Chorus] בשורה נפרדת — אבל זה ממש לא חובה, גם טקסט רציף עובד מצוין."
                    }
                  />
                  <span className="story-field-hint">נפיק את השיר בדיוק לפי המילים שכתבתם, בלי לשנות אותן.</span>
                </label>
              )}

              <div className="chip-field">
                <span className="story-field-label">איך אתם רוצים שהשיר ירגיש?</span>
                <div className="mood-chips">
                  {MOOD_CHIPS.map((mood) => (
                    <button
                      className={order.moods.includes(mood.id) ? "mood-chip selected" : "mood-chip"}
                      key={mood.id}
                      onClick={() => toggleMood(mood.id)}
                      type="button"
                    >
                      <span className="mood-chip-emoji">{mood.emoji}</span>
                      {mood.label}
                    </button>
                  ))}
                </div>
              </div>

              {order.musicMode !== "reference" && (
                <div className="story-field">
                  <button
                    aria-expanded={showInspirationField}
                    className="advanced-options-toggle"
                    onClick={() => setShowInspirationField((value) => !value)}
                    type="button"
                  >
                    יש זמר או שיר שאתם אוהבים? <span className="story-field-optional">אופציונלי</span>
                    <ChevronDown className={showInspirationField ? "advanced-options-chevron open" : "advanced-options-chevron"} size={14} />
                  </button>
                  {showInspirationField && (
                    <div className="advanced-options-panel">
                      <input
                        onChange={(event) => setField("inspiration", event.target.value)}
                        placeholder="לדוגמה: עומר אדם, אושר כהן, פופ ישראלי..."
                        value={order.inspiration}
                      />
                      <span className="story-field-hint">נשתמש בזה כהשראה כללית לסגנון — לא כשכפול של שיר קיים.</span>
                    </div>
                  )}
                </div>
              )}

              {order.musicMode === "reference" && (
                <div className="story-field melody-field">
                  <span className="story-field-label">יש לכם הקלטה שתשמש כהשראה?</span>
                  <span className="story-field-hint">
                    הקליטו או העלו קטע קצר — המהום, נגינה או כל רעיון מוזיקלי — ושירלי תשתמש בו כהשראה לאווירה, לקצב
                    ולסגנון של השיר.
                  </span>
                  <p className="melody-disclaimer">
                    חשוב לדעת: זו לא שכפול מדויק של הלחן — ההקלטה משפיעה על האווירה, הקצב והסגנון של השיר החדש, לא
                    מחליפה את הלחן המקורי.
                  </p>

                  {!order.melodySongId && (
                    <div className="melody-upload-actions">
                      <button className="ghost-button" onClick={() => melodyFileInputRef.current?.click()} type="button">
                        <MusicNote size={16} />
                        העלאת הקלטה
                      </button>
                      <button
                        className={isRecordingMelody ? "ghost-button melody-recording" : "ghost-button"}
                        onClick={isRecordingMelody ? stopRecordingMelody : startRecordingMelody}
                        type="button"
                      >
                        <Mic size={16} />
                        {isRecordingMelody ? `עצירת הקלטה (${recordingSeconds}s)` : "הקלטת קול"}
                      </button>
                      <input
                        accept="audio/*"
                        hidden
                        onChange={handleMelodyFileChange}
                        ref={melodyFileInputRef}
                        type="file"
                      />
                    </div>
                  )}

                  {melodyUploadStatus === "uploading" && (
                    <p className="lyrics-draft-preview-status">
                      <Loader size={15} /> מעלים את ההקלטה...
                    </p>
                  )}

                  {melodyError && <p className="status-message error">{melodyError}</p>}

                  {order.melodySongId && melodyUploadStatus === "ready" && (
                    <div className="melody-preview-card">
                      <p className="melody-ready-label">ההקלטה שלכם מוכנה ✨</p>
                      {melodyPreviewUrl && <audio controls src={melodyPreviewUrl} />}
                      <div className="melody-preview-actions">
                        <button className="ghost-button" onClick={removeMelody} type="button">
                          <Refresh size={15} />
                          הסרה והחלפה
                        </button>
                      </div>
                      <label className="consent-row">
                        <input
                          checked={order.melodyRightsConfirmed}
                          onChange={(event) => setField("melodyRightsConfirmed", event.target.checked)}
                          type="checkbox"
                        />
                        <span>אני מאשר/ת שההקלטה היא שלי או שיש לי הרשאה להשתמש בה.</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <button
                aria-expanded={advancedOpen}
                className="advanced-options-toggle"
                onClick={() => setAdvancedOpen((value) => !value)}
                type="button"
              >
                אפשרויות נוספות
                <ChevronDown className={advancedOpen ? "advanced-options-chevron open" : "advanced-options-chevron"} size={14} />
              </button>

              {advancedOpen && (
                <label className="story-field advanced-options-panel">
                  <span className="story-field-label">יש משהו שלא תרצו שיופיע בשיר?</span>
                  <input
                    onChange={(event) => setField("avoid", event.target.value)}
                    placeholder="למשל: לא להזכיר גיל, לא להשתמש בשם משפחה, בלי חיקוי זמר מוכר"
                    value={order.avoid}
                  />
                </label>
              )}

              <div className="form-footer">
                <button className="ghost-button" type="button" onClick={() => setStep(0)}>
                  חזרה
                </button>
                <button className="primary-button" type="button" onClick={() => setStep(2)}>
                  המשך
                  <ArrowLeft size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-panel confirm-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <CheckCircle size={18} />
                </span>
                <div>
                  <h3>רק לוודא שהבנו נכון ✨</h3>
                  <p>ככה השיר שלכם עומד להיראות. אפשר לאשר או לחזור ולשנות.</p>
                </div>
              </div>

              {order.lyricsMode === "auto" && order.story.trim().length < 15 && (
                <p className="confirm-nudge">
                  <AlertTriangle size={15} />
                  רגע — ספרו לנו עוד קצת כדי שהשיר יצא מדויק יותר.
                  <button className="confirm-nudge-link" onClick={() => setStep(1)} type="button">
                    להוסיף פרטים
                  </button>
                </p>
              )}

              <div className="confirm-summary-card">
                <p>{buildConfirmationSummary(order)}</p>
              </div>

              {canPreviewLyrics && (
                <div className="lyrics-draft-preview">
                  <span className="story-field-label">כך יראו מילות השיר</span>

                  {!displayLyricsPreview && order.lyricsMode === "auto" && !lyricsPreviewError && (
                    <p className="lyrics-draft-preview-status">טוענים את המילים...</p>
                  )}

                  {!displayLyricsPreview && order.lyricsMode === "auto" && lyricsPreviewError && (
                    <p className="lyrics-draft-preview-status">
                      לא הצלחנו לטעון תצוגה מקדימה של המילים כרגע — אפשר להמשיך בכל זאת.
                    </p>
                  )}

                  {displayLyricsPreview && (
                    <div className="lyrics-draft-preview-card">
                      {displayLyricsPreview.split("\n").map((line, index) =>
                        /^\[[^\]]+\]$/.test(line.trim()) ? (
                          <span className="lyrics-draft-preview-tag" key={index}>
                            {line.trim().replace(/[[\]]/g, "")}
                          </span>
                        ) : (
                          <p key={index}>{line}</p>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="confirm-actions">
                <button className="primary-button" type="button" onClick={() => setStep(3)}>
                  כן, תכינו לי שיר 🎵
                </button>
                <button className="ghost-button" type="button" onClick={() => setStep(1)}>
                  רוצה לשנות משהו
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-panel summary-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <CheckCircle size={18} />
                </span>
                <div>
                  <h3>מאשרים ושולחים</h3>
                  <p>עוד כמה פרטים ליצירת קשר, ואז שולחים ליצירה.</p>
                </div>
              </div>

              <div className="field-grid">
                <label>
                  שם מלא
                  <input
                    required
                    value={order.customerName}
                    onChange={(event) => setField("customerName", event.target.value)}
                    placeholder="השם שלך"
                  />
                </label>
                <label>
                  טלפון
                  <input
                    dir="ltr"
                    required
                    type="tel"
                    value={order.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    placeholder="050-0000000"
                  />
                </label>
                <label className="wide">
                  אימייל
                  <input
                    dir="ltr"
                    required
                    type="email"
                    value={order.email}
                    onChange={(event) => setField("email", event.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
              </div>

              <div className="summary-grid">
                <div>
                  <span>סוג השיר</span>
                  <strong>{selectedType.label}</strong>
                </div>
                <div>
                  <span>האירוע</span>
                  <strong>{resolvedOccasion || "—"}</strong>
                </div>
                <div>
                  <span>מה מקבלים</span>
                  <strong>{orderMode === "demo" ? "דמו להאזנה באתר" : "שתי גרסאות"}</strong>
                </div>
                {orderMode === "full" && (
                  <div>
                    <span>משך השיר</span>
                    <strong>
                      {SONG_LENGTH_OPTIONS.find((option) => option.seconds === order.songLengthSeconds)?.label}
                    </strong>
                  </div>
                )}
                <div>
                  <span>עלות</span>
                  <strong>{orderMode === "demo" ? "חינם" : `${CREDITS_PER_SONG} קרדיטים`}</strong>
                </div>
              </div>

              <label className="consent-row">
                <input
                  checked={order.consent}
                  required
                  onChange={(event) => setField("consent", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  אני מאשר/ת שהפרטים שמסרתי מותרים לשימוש, אינם מפרים זכויות, ושלא ביקשתי
                  חיקוי של אמן/קול/שיר מוגן ללא אישור.
                </span>
              </label>

              {orderMode === "full" && !isAdmin && !hasEnoughCredits ? (
                <div className="insufficient-credits-panel">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>חסרים לך קרדיטים להפקת השיר</strong>
                    <p>להפקת שיר מלא נדרשים {CREDITS_PER_SONG} קרדיטים.</p>
                    <div className="insufficient-credits-actions">
                      <button onClick={() => handleSelectPlan(singleSongPlan)} type="button">
                        רכישת שיר בודד
                      </button>
                      <button onClick={() => (window.location.href = "/pricing?tab=packs")} type="button">
                        צפייה בחבילות
                      </button>
                      <button onClick={() => (window.location.href = "/pricing?tab=subscriptions")} type="button">
                        הצטרפות למנוי
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {orderMode === "full" && !isAdmin && (
                    <p className="pay-hint">הפקת השיר המלא תשתמש ב-{CREDITS_PER_SONG} קרדיטים מהיתרה שלך.</p>
                  )}
                  <button className="pay-button" disabled={status === "sending"} type="submit">
                    {status === "sending" ? <Loader size={18} /> : <Lock size={18} />}
                    {status === "sending" ? "יוצרים את השיר..." : orderMode === "demo" ? "יצירת דמו חינם" : "אישור והפקת השיר"}
                  </button>
                </>
              )}

              {result && (
                <div className="api-result">
                  <CheckCircle size={20} />
                  <div>
                    <strong>{result.mode === "demo" ? "הדמו שלכם מוכן!" : "השיר שלכם מוכן!"}</strong>
                    <span>
                      {result.mode === "demo"
                        ? "אפשר להאזין למטה — הדמו מיועד להאזנה באתר בלבד."
                        : "שתי הגרסאות מוכנות — אפשר להאזין, להוריד ולשתף."}
                    </span>
                    {result.promptPreview && (
                      <div className="lyrics-preview">
                        <span className="lyrics-preview-label">מילות השיר</span>
                        <p>{result.promptPreview}</p>
                      </div>
                    )}
                    {result.versions.some((version) => version.audioDataUrl) && (
                      <div className="audio-delivery">
                        {result.versions.map((version) => (
                          <div className="audio-delivery-version" key={version.label}>
                            {result.versions.length > 1 && <span className="audio-delivery-label">גרסה {version.label}</span>}
                            {version.audioDataUrl && (
                              <>
                                <audio controls src={version.audioDataUrl}>
                                  הדפדפן שלך לא תומך בנגן אודיו.
                                </audio>
                                {result.mode === "full" && (
                                  <a download={version.downloadFileName || "custom-song.mp3"} href={version.audioDataUrl}>
                                    להורדת השיר
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.mode === "demo" && (
                      <div className="demo-upsell">
                        <strong>אהבתם את הכיוון? השיר המלא מחכה לכם</strong>
                        <p>קבלו שתי גרסאות מלאות באורך של עד 3 דקות, מוכנות להורדה ולשיתוף.</p>
                        <button
                          className="primary-button"
                          onClick={() => {
                            setOrderMode("full");
                            setResult(null);
                            setStatus("idle");
                            setStep(3);
                          }}
                          type="button"
                        >
                          קבלת השיר המלא
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </form>

        <aside className="order-sidebar" aria-label="ההזמנה שלך">
          <button
            aria-controls="order-summary-panel"
            aria-expanded={summaryOpenMobile}
            className="order-summary-toggle"
            onClick={() => setSummaryOpenMobile((v) => !v)}
            type="button"
          >
            <span>ההזמנה שלך</span>
            <span className="order-summary-toggle-end">
              <span className="order-summary-toggle-price">
                {orderMode === "demo" ? "חינם" : `${CREDITS_PER_SONG} קרדיטים`}
              </span>
              <ChevronDown className="order-summary-toggle-chevron" size={16} />
            </span>
          </button>

          <div className={summaryOpenMobile ? "order-summary-card open" : "order-summary-card"} id="order-summary-panel">
            <h3 className="order-summary-title">ההזמנה שלך</h3>

            <dl className="order-summary-facts">
              <div>
                <dt>סוג השיר</dt>
                <dd>{selectedType.label}</dd>
              </div>
              <div>
                <dt>מה מקבלים</dt>
                <dd>{orderMode === "demo" ? "דמו להאזנה" : "שתי גרסאות"}</dd>
              </div>
              {orderMode === "full" && (
                <div>
                  <dt>משך השיר</dt>
                  <dd>{SONG_LENGTH_OPTIONS.find((option) => option.seconds === order.songLengthSeconds)?.label}</dd>
                </div>
              )}
              <div>
                <dt>עלות</dt>
                <dd>{orderMode === "demo" ? "חינם" : `${CREDITS_PER_SONG} קרדיטים`}</dd>
              </div>
              <div>
                <dt>היתרה שלך</dt>
                <dd>{isAdmin ? "ללא הגבלה" : `${creditBalance} קרדיטים`}</dd>
              </div>
            </dl>

            <div className="order-summary-progress">
              <div className="progress-heading">
                <span>שלמות פרטים</span>
                <strong>{completion}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>

            <ul className="order-benefits">
              {[
                "אישור המילים לפני ההפקה",
                "שתי גרסאות שונות לבחירה",
                "קובץ שמע מוכן להורדה",
                "אזור אישי לצפייה בהזמנות",
              ].map((item) => (
                <li key={item}>
                  <CheckSmall size={15} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <div className="admin-quota-card">
              <div className="admin-quota-heading">
                <span>מסך ניהול — מלאי ספק המוזיקה</span>
                <span className={isLiveProviderQuota ? "connected-pill" : "connected-pill offline"}>
                  <span className="connected-dot" />
                  {isLiveProviderQuota ? "מחובר" : providerQuotaStatus === "loading" ? "בודק" : "מצב הדגמה"}
                </span>
              </div>

              {isLiveProviderQuota ? (
                <>
                  <div className="admin-quota-stat">
                    <span>{formatCompact(providerQuota?.limit)} /</span>
                    <strong>{formatCompact(providerQuota?.remaining)}</strong>
                  </div>
                  <div className="admin-quota-track">
                    <span style={{ width: `${providerQuota?.percentUsed ?? 0}%` }} />
                  </div>
                  <div className="admin-quota-grid">
                    <div>
                      <span>תוכנית</span>
                      <strong>{providerQuota?.tier || "לא ידוע"}</strong>
                    </div>
                    <div>
                      <span>נוצל</span>
                      <strong>{formatNumber(providerQuota?.used)}</strong>
                    </div>
                  </div>
                  <div className="admin-quota-footer">
                    <span>{providerQuota?.overageDisabled ? "חריגה כבויה" : "חריגה אפשרית"}</span>
                    <span>איפוס ב: {formatReset(providerQuota?.nextReset)}</span>
                  </div>
                </>
              ) : (
                <p className="admin-quota-fallback">
                  {providerQuotaStatus === "loading" ? "בודק חיבור..." : "אין מפתח ספק פעיל — מצב הדגמה."}
                </p>
              )}
            </div>
          )}
        </aside>
      </section>

      <section id="legal" className="legal-section">
        <div className="section-intro">
          <p className="eyebrow">לפני שמתחילים</p>
          <h2>כמה דברים חשובים לפני שמתחילים.</h2>
        </div>

        <div className="rules-group">
          <h3 className="rules-group-title rules-group-title--good">מה אפשר ליצור</h3>
          <div className="rules-list rules-list--3">
            {allowedRules.map((rule) => (
              <div className="rule-card" key={rule.title}>
                <span className="rule-icon good">
                  <rule.icon size={17} />
                </span>
                <div>
                  <strong>{rule.title}</strong>
                  <p>{rule.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rules-group">
          <h3 className="rules-group-title rules-group-title--bad">מה לא ניתן ליצור</h3>
          <div className="rules-list rules-list--4">
            {blockedRules.map((rule) => (
              <div className="rule-card" key={rule.title}>
                <span className="rule-icon bad">
                  <rule.icon size={17} />
                </span>
                <div>
                  <strong>{rule.title}</strong>
                  <p>{rule.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-cta-band">
        <div className="pricing-cta-band-inner">
          <div className="pricing-cta-band-copy">
            <h3>רוצים לראות את כל אפשרויות הרכישה?</h3>
            <p>שיר בודד, חבילות שירים או מנוי חודשי — כל המחירים והחיסכון במקום אחד.</p>
          </div>
          <Link className="pricing-cta-band-button" href="/pricing">
            <Coin size={18} />
            למעבר לעמוד המחירים
            <ArrowLeft size={16} />
          </Link>
        </div>
      </section>

      <section id="how" className="process-band" aria-label="איך זה עובד">
        <p className="process-band-caption">התהליך אוטומטי לחלוטין — מרגע ההזמנה ועד ההורדה, ללא מגע אנושי.</p>
        <p className="process-band-credit">
          השירים מופקים באמצעות <span dir="ltr">ElevenLabs Music</span>.
        </p>
        <div className="process-band-inner">
          {processSteps.map((item, index) => {
            const state =
              index < activeProcessIndex ? "done" : index === activeProcessIndex ? "active" : "upcoming";

            return (
              <div className={`process-item process-item--${state}`} key={item.title}>
                <span className="process-item-marker">{state === "done" ? <CheckSmall size={14} /> : index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SiteFooter />

      <a className="scroll-top-fab" href="#top" aria-label="חזרה לראש העמוד">
        <ArrowUp size={20} />
      </a>

      {checkoutPlan && <BillingModal account={account} plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />}
    </main>
  );
}
