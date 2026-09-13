"use client";

// Forked from ../page.tsx (the Hebrew order flow), not extracted into a
// shared parameterized component — see the approved plan
// (lazy-herding-sutherland.md). app/page.tsx is the live revenue path and
// was just stabilized; every line below is code the Hebrew flow never
// executes, so this file can change freely without any risk to it. Keep
// this in sync manually if the Hebrew flow's state machine/validation
// logic changes — there is deliberately no shared abstraction.

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
} from "../icons";
import { BillingModal } from "../BillingModal";
import { JsonLd } from "../JsonLd";
import { promptSignIn } from "../promptSignIn";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import {
  CREDITS_PER_SONG,
  creditPacks,
  DEFAULT_SONG_LENGTH_SECONDS,
  FREE_DEMO,
  MAX_VERSION_SECONDS,
  PricingPlan,
  singleSongPlan,
  SONG_LENGTH_OPTIONS,
  subscriptionPlans,
} from "@/lib/pricing-catalog";
import { SITE_URL } from "@/lib/site-config";
import { useAccount } from "../useAccount";

type SongType = "gift" | "business" | "graduation";
type OrderStatus = "idle" | "sending" | "ready" | "error";

type LyricsMode = "auto" | "custom";

// "Surprise me" (default) / "I have style inspiration" (free-text style
// reference) / "I have a recording for inspiration" (uploaded/recorded
// audio reference — musical inspiration only, never framed as melody
// preservation) — independent of LyricsMode, since who writes the words
// and how the music is directed are separate choices.
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
// "graduation") is the real field sent to the server and must not change,
// it has to match what app/page.tsx sends for the same three song types.
const songTypes: Array<{
  id: SongType;
  label: string;
  description: string;
  icon: typeof Gift;
}> = [
  {
    id: "gift",
    label: "Gift song",
    description: "For a birthday, relationship, wedding, graduation, or a heartfelt surprise.",
    icon: Gift,
  },
  {
    id: "business",
    label: "Business song",
    description: "For an ad, event, campaign, intro, or social content.",
    icon: Storefront,
  },
  {
    id: "graduation",
    label: "Party or event song",
    description: "For a preschool, school, team, graduation party, or family celebration.",
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

const OCCASION_CHIPS = ["Birthday", "Wedding", "Anniversary", "Family", "Friend", "Farewell", "Business", "Other"];

// IMPORTANT: these ids must stay exactly "moved" | "funny" | "romantic" |
// "happy" | "upbeat" — lib/song-generation.ts's MOOD_CHIP_DIRECTIONS_EN
// dictionary is keyed by exactly these 5 strings. Sending anything else
// means the mood direction silently fails to match and falls through to
// a generic default instead of actually steering the song.
const MOOD_CHIPS: Array<{ id: string; label: string; emoji: string }> = [
  { id: "moved", label: "Moved", emoji: "❤️" },
  { id: "funny", label: "Funny", emoji: "😂" },
  { id: "romantic", label: "Romantic", emoji: "🥰" },
  { id: "happy", label: "Happy", emoji: "🎉" },
  { id: "upbeat", label: "Upbeat", emoji: "😎" },
];

const MAX_MOODS = 2;

function resolveOccasion(order: OrderPayload) {
  return order.occasionChip === "Other" ? order.occasionCustom.trim() : order.occasionChip;
}

// Drives both the client pre-submit check and which step to send the
// customer back to if something's missing — recipient/occasion/story live
// in step 1, contact details live in step 3 (see spec: don't ask for
// contact info while the customer is still telling the story). Mirrors
// getMissingFieldInfo() in ../page.tsx field-for-field, English copy only.
function getMissingFieldInfo(order: OrderPayload): { label: string; step: number } | null {
  if (!order.recipient.trim()) {
    return { label: "who the song is for", step: 1 };
  }

  if (!order.recipientGender) {
    return { label: "whether it's for a man or a woman", step: 1 };
  }

  if (!order.occasionChip) {
    return { label: "the occasion", step: 1 };
  }

  if (order.occasionChip === "Other" && !order.occasionCustom.trim()) {
    return { label: "the occasion details", step: 1 };
  }

  if (order.lyricsMode === "custom" ? !order.customLyrics.trim() : !order.story.trim()) {
    return { label: order.lyricsMode === "custom" ? "the song lyrics" : "the story", step: 1 };
  }

  if (order.musicMode === "reference") {
    if (!order.melodySongId) {
      return { label: "the recording", step: 1 };
    }

    if (!order.melodyRightsConfirmed) {
      return { label: "rights confirmation for the recording", step: 1 };
    }
  }

  if (!order.customerName.trim()) {
    return { label: "your name", step: 3 };
  }

  if (!order.email.trim()) {
    return { label: "email", step: 3 };
  }

  if (!order.phone.trim()) {
    return { label: "phone", step: 3 };
  }

  return null;
}

function buildConfirmationSummary(order: OrderPayload) {
  const occasion = resolveOccasion(order) || "the occasion you told us about";
  const recipient = order.recipient.trim() || "the person you chose";
  const sentences = [
    `This song is for ${recipient}, for ${occasion}.`,
    order.lyricsMode === "custom"
      ? "We'll produce the song exactly to the words you wrote."
      : "We read the story you shared and will weave it into the lyrics.",
  ];

  const useInspiration = order.musicMode === "inspiration" && order.inspiration.trim();

  if (order.moods.length > 0) {
    const moodsText = order.moods.map((mood) => mood.toLowerCase()).join(" and ");
    sentences.push(
      useInspiration
        ? `We'll make a song that feels ${moodsText}, inspired by the style of ${order.inspiration.trim()}.`
        : `We'll make a song that feels ${moodsText}.`,
    );
  } else if (useInspiration) {
    sentences.push(`We'll make a song inspired by the style of ${order.inspiration.trim()}.`);
  }

  if (order.musicMode === "reference") {
    sentences.push(
      "Shirli will use the recording you uploaded as inspiration for the song's mood, tempo, and style — not as a copy of the melody.",
    );
  }

  return sentences.join(" ");
}

const processSteps = [
  { title: "Choose a song type", detail: "Birthday, wedding, relationship, business, or any other occasion." },
  { title: "Tell your story", detail: "Add names, memories, jokes, and special moments." },
  { title: "Confirm the lyrics", detail: "Review what we understood and confirm before production." },
  { title: "Download your song", detail: "Finished versions are available in your account area to download and share." },
];

const allowedRules = [
  {
    icon: Lyrics,
    title: "A personal story",
    detail: "Use real names, memories, jokes, and special moments.",
  },
  {
    icon: MusicNote,
    title: "A musical style of your choice",
    detail: "Ask for a happy, moving, upbeat, calm, or festive song.",
  },
  {
    icon: Edit,
    title: "Lyric revisions",
    detail: "Before production, you can review the lyrics and ask for changes.",
  },
];

const blockedRules = [
  {
    icon: Copy,
    title: "Copying existing songs",
    detail: "We can't use the lyrics or melody of a copyrighted song.",
  },
  {
    icon: Mic,
    title: "Exact impersonation of a singer",
    detail: "You can choose a general style, but not an exact imitation of a real person's voice.",
  },
  {
    icon: AlertTriangle,
    title: "Offensive or non-consensual content",
    detail: "We won't create content that demeans another person or misuses their personal details.",
  },
  {
    icon: Lock,
    title: "A guarantee of commercial success",
    detail: "We can't promise a song will go viral, get published, or generate income.",
  },
];

// English-only customer-facing names for the shared numeric catalog in
// lib/pricing-catalog.ts, which only has Hebrew `.name`/`.features` —
// same pattern the previous version of this file already used.
const PACK_NAMES_EN: Record<string, string> = {
  "pack-3": "3-song pack",
  "pack-5": "5-song pack",
};

const PLAN_NAMES_EN: Record<string, string> = {
  "plan-personal": "Personal plan",
  "plan-family": "Family plan",
  "plan-creators": "Creators plan",
};

const LENGTH_LABELS_EN: Record<number, string> = {
  60: "One minute",
  120: "Two minutes",
  [MAX_VERSION_SECONDS]: "Up to 3 minutes",
};

function lengthLabelEn(seconds: number) {
  return LENGTH_LABELS_EN[seconds] ?? `${seconds}s`;
}

// English-language counterpart of lib/structured-data.ts's
// homeServiceJsonLd, defined locally instead of imported — that constant
// is entirely hand-written Hebrew copy (name/serviceType/description) and
// areaServed: "IL", so reusing it here would put Hebrew structured data
// on an English page. lib/structured-data.ts is out of scope for this
// change, so this stays a small local object built from the same
// numeric catalog instead.
const englishServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/en#service`,
  name: "Personal custom song",
  serviceType: "Personal English song creation",
  description: `Tell us about the person, the occasion, and the moments that matter — the system automatically writes, composes, and produces an original personal song in English within minutes, ready to download and share. Every full song includes two musical versions up to ${MAX_VERSION_SECONDS / 60} minutes long, and you can hear a free ${FREE_DEMO.seconds}-second demo first.`,
  areaServed: "US",
  url: `${SITE_URL}/en`,
  offers: {
    "@type": "Offer",
    name: "Single song",
    description: `${singleSongPlan.credits} credits, enough for one full song.`,
    price: singleSongPlan.priceIls,
    priceCurrency: "ILS",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/pricing`,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");

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
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function EnglishOrderPage() {
  const account = useAccount();
  const [step, setStep] = useState(0);
  // Gates the whole order-tool behind the two upfront decisions ("what
  // about the lyrics?" / "what about the melody?") — order.lyricsMode/
  // musicMode already drive every downstream question, this just makes
  // the choice the very first thing a customer sees instead of a toggle
  // buried in step 1.
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
    setStep(1);
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

        // Same shared route the Hebrew flow uses — audio upload has no
        // language, ElevenLabs song_id lookup is language-agnostic.
        const response = await fetch("/api/orders/upload-melody", {
          method: "POST",
          headers: { Authorization: `Bearer ${account.session.access_token}` },
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as { songId?: string; error?: string } | null;

        if (!response.ok || !data?.songId) {
          throw new Error("Error uploading the recording");
        }

        setOrder((current) => ({ ...current, melodySongId: data.songId as string }));
        setMelodyUploadStatus("ready");
      } catch (err) {
        setMelodyUploadStatus("error");
        setMelodyError(err instanceof Error ? err.message : "Error uploading the recording");
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
        void uploadMelodyFile(blob, `recording-${Date.now()}.webm`);
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
      setMelodyError("We couldn't access the microphone — you can upload a file instead.");
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
    setStep(1);
    // The free demo is meant to be an instant taste — skip the decision
    // gate too rather than asking a demo customer to make choices that
    // barely matter for a 20-second, no-reference-audio sample.
    setDecisionMade(true);
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
  // getEnglishLyrics() calls Gemini (a real, quota'd API), so debounce
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
          language: "en",
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
  // and a delivered result bumps it to the final "download the song" step.
  const activeProcessIndex = result ? 3 : step;

  const setField = <K extends keyof OrderPayload>(key: K, value: OrderPayload[K]) => {
    setOrder((current) => ({ ...current, [key]: value }));
  };

  const selectOccasion = (chip: string) => {
    setOrder((current) => ({
      ...current,
      occasionChip: chip,
      occasionCustom: chip === "Other" ? current.occasionCustom : "",
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
      setOrderError(`Missing detail: "${missingField.label}".`);
      setStatus("error");
      return;
    }

    if (orderMode === "full" && !hasEnoughCredits) {
      // The insufficient-credits panel below the summary already covers
      // this case — this is just a defensive guard against a stale
      // balance if credits changed in another tab.
      setOrderError("You don't have enough credits to create the song");
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
          language: "en",
        }),
      });

      if (response.status === 409) {
        setOrderError("You've already created your free demo — you can purchase a full song.");
        setStatus("error");
        void account.refreshCredits();
        return;
      }

      if (response.status === 402) {
        setOrderError("You don't have enough credits to create the song");
        setStatus("error");
        void account.refreshCredits();
        return;
      }

      if (response.status === 400) {
        setStep(1);
        setOrderError('Some details are missing from the form — please check the "Tell your story" step and make sure everything is filled in.');
        setStatus("error");
        return;
      }

      if (response.status === 502) {
        // Deliberately not reading the server's `error` text here — the
        // shared /api/orders route (untouched by this change) still
        // replies in Hebrew for this case, and this page never wants to
        // surface Hebrew copy to an English customer. Credits are still
        // refunded server-side regardless of what this message says.
        setOrderError("A temporary issue while producing the song — your credits were refunded to your account. You can try again.");
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
      setOrderError("We couldn't complete this right now. Please try again in a few minutes.");
      setStatus("error");
    }
  };

  return (
    <main className="site-shell en-order-page" dir="ltr" lang="en">
      <SiteHeader
        account={account}
        homeHref="/en#top"
        navLinks={[
          { href: "/en#how", label: "How it works" },
          { href: "/en#pricing", label: "Pricing" },
          { href: "/en#legal", label: "What's allowed" },
        ]}
        navAriaLabel="Main navigation"
        newSongLabel="New Song"
        onNewSong={() => {
          startNewOrder();
          goToSection("order");
        }}
        adminSlot={
          isAdmin ? (
            <div className="admin-quota-pill" title="Admin view — music provider quota">
              <Coin size={15} className="coin-icon" />
              <strong>
                {providerQuotaStatus === "loading"
                  ? "Checking..."
                  : providerQuotaStatus === "error"
                    ? "Unavailable"
                    : formatNumber(providerQuota?.remaining)}
              </strong>
              <button type="button" onClick={refreshProviderQuota} aria-label="Refresh">
                <Refresh size={12} />
              </button>
            </div>
          ) : undefined
        }
      />

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <h1>Turn your story into a personal song, sung in English.</h1>
          <p className="hero-text">
            Tell the system about the person, the occasion, and the moments that matter. It writes, composes, and
            produces an original song automatically within minutes, ready to share and download.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#order">
              <PlayCircle size={20} />
              Start creating your song
            </a>
            <a className="secondary-link" href="#how">
              How does it work?
            </a>
          </div>
          <dl className="trust-strip" aria-label="Why choose us">
            <div>
              <dt>Two versions to choose from</dt>
              <dd>You’ll get two different versions and pick the one you love most.</dd>
            </div>
            <div>
              <dt>Ready to share and download</dt>
              <dd>A high-quality audio file you can send to family and friends.</dd>
            </div>
          </dl>
        </div>

        <div className="studio-visual" aria-label="Song preview">
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

            <button className="player-card-play" type="button" aria-label="Play sample song">
              <PlayCircle size={26} strokeWidth={1.6} />
            </button>

            <div className="player-card-bottom">
              <div>
                <strong className="cover-title">Emma’s song</strong>
                <span className="cover-subtitle">Contemporary pop</span>
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
            <h2>Hear it before you pay</h2>
            <p>Tell us a few details and get a personal 20-second demo, free and with no commitment.</p>
          </div>
          <div className="demo-hook-actions">
            <button className="primary-button" disabled={freeDemoUsed && !isAdmin} onClick={handleStartDemo} type="button">
              <PlayCircle size={18} />
              {freeDemoUsed && !isAdmin ? "You've already created your free demo" : "Create a free demo"}
            </button>
            <span className="demo-hook-hint">No credit card required</span>
          </div>
        </div>
      </section>

      <section id="order" className="order-section">
        <div className="section-intro">
          <p className="eyebrow">Our process</p>
          <h2>
            Everything you need
            <br />
            <span className="accent-text-alt">to turn a story into a song.</span>
          </h2>
          <p>Fill in a few details, confirm the lyrics before production, and get a song ready to download and share.</p>
        </div>

        <form className="order-tool" onSubmit={submitOrder}>
          {!decisionMade ? (
            <div className="form-panel decision-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <Edit size={18} />
                </span>
                <div>
                  <h3>Let’s get started</h3>
                  <p>Two quick questions, and we’ll build the exact process that fits you.</p>
                </div>
              </div>

              <div className="decision-question">
                <span className="story-field-label">What about the lyrics?</span>
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
                    <strong>I have lyrics</strong>
                    <span>I’ve already written the words for the song</span>
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
                    <strong>Write them for me</strong>
                    <span>I’ll tell you about it and we’ll write the lyrics</span>
                  </label>
                </div>
              </div>

              <div className="decision-question">
                <span className="story-field-label">What about the melody?</span>
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
                    <strong>I have a recording for inspiration</strong>
                    <span>Record, hum, sing, or upload a file</span>
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
                    <strong>Create the music for me</strong>
                    <span>The system will create a melody and production for the song</span>
                  </label>
                </div>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  setDecisionMade(true);
                  setStep(1);
                }}
                type="button"
              >
                Let’s start
                <ArrowLeft className="icon-flip-ltr" size={18} />
              </button>
            </div>
          ) : (
            <>
          <div className="steps" aria-label="Song creation progress">
            {[
              { index: 1, label: order.lyricsMode === "custom" ? "Lyrics" : "Story" },
              { index: 2, label: "Confirm" },
              { index: 3, label: "Summary" },
            ].map(({ index, label }, position, all) => (
              <Fragment key={label}>
                <button
                  className={step === index ? "active" : step > index ? "done" : ""}
                  type="button"
                  onClick={() => setStep(index)}
                >
                  <span className="step-badge">{step > index ? <CheckSmall size={13} /> : position + 1}</span>
                  <span className="step-label">{label}</span>
                </button>
                {position < all.length - 1 && <span className="step-connector" aria-hidden="true" />}
              </Fragment>
            ))}
          </div>

          {status === "error" && orderError && (
            <p className="status-message error form-level-error">{orderError}</p>
          )}

          {step === 1 && (
            <div className="form-panel story-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <Edit size={18} />
                </span>
                <div>
                  <h3>Who’s the song for?</h3>
                  <p>Just a few small details, and the system will turn them into a song.</p>
                </div>
              </div>

              <div className="chip-field">
                <span className="story-field-label">What moment are we turning into a song?</span>
                <div className="occasion-chips">
                  {songTypes.map((type) => (
                    <button
                      className={order.songType === type.id ? "occasion-chip selected" : "occasion-chip"}
                      key={type.id}
                      onClick={() => setField("songType", type.id)}
                      type="button"
                    >
                      <type.icon size={15} />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {orderMode === "full" && (
                <div className="length-picker">
                  <span className="length-picker-label">Song length</span>
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
                        <strong>{lengthLabelEn(option.seconds)}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {orderMode === "demo" && (
                <p className="demo-mode-note">
                  <PlayCircle size={15} />
                  Creating a free 20-second demo — no payment, no commitment.
                </p>
              )}

              <label className="story-field">
                <span className="story-field-label">Who is the song for?</span>
                <input
                  required
                  value={order.recipient}
                  onChange={(event) => setField("recipient", event.target.value)}
                  placeholder="e.g., Emma, my girlfriend"
                />
              </label>

              <div className="chip-field">
                <span className="story-field-label">{order.recipient.trim() || "The person this song is for"} is...</span>
                <div className="occasion-chips">
                  <button
                    className={order.recipientGender === "male" ? "occasion-chip selected" : "occasion-chip"}
                    onClick={() => setField("recipientGender", "male")}
                    type="button"
                  >
                    He
                  </button>
                  <button
                    className={order.recipientGender === "female" ? "occasion-chip selected" : "occasion-chip"}
                    onClick={() => setField("recipientGender", "female")}
                    type="button"
                  >
                    She
                  </button>
                </div>
                <span className="story-field-hint">So the lyrics use the right pronouns.</span>
              </div>

              <div className="chip-field">
                <span className="story-field-label">What are you celebrating?</span>
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
                {order.occasionChip === "Other" && (
                  <input
                    className="occasion-other-input"
                    onChange={(event) => setField("occasionCustom", event.target.value)}
                    placeholder="What's the occasion?"
                    value={order.occasionCustom}
                  />
                )}
              </div>

              {order.lyricsMode === "auto" ? (
                <>
                  <label className="story-field story-field--main">
                    <span className="story-field-label">
                      Tell us a bit about {order.recipient.trim() || "the person this song is for"}
                    </span>
                    <textarea
                      className="story-textarea"
                      required
                      value={order.story}
                      onChange={(event) => setField("story", event.target.value)}
                      placeholder={
                        "How did you meet? What do you love doing together? Something funny that happened? A moment you'll never forget? A special nickname? Details that describe them?\n\nDon't worry about making it sound polished — just tell us. We'll turn it into a song."
                      }
                    />
                    <span className="story-field-hint">The more you share, the more personal the song will feel.</span>
                  </label>

                  <label className="story-field">
                    <span className="story-field-label">Is there anything that has to be in the song?</span>
                    <input
                      onChange={(event) => setField("mustInclude", event.target.value)}
                      placeholder="e.g., the nickname 'Sunshine', the trip to Greece, that thing they always say..."
                      value={order.mustInclude}
                    />
                  </label>
                </>
              ) : (
                <label className="story-field story-field--main">
                  <span className="story-field-label">Paste your full song lyrics here</span>
                  <textarea
                    className="story-textarea"
                    required
                    value={order.customLyrics}
                    onChange={(event) => setField("customLyrics", event.target.value)}
                    placeholder={
                      "You can write out the entire song exactly as you want it.\n\nIf it's convenient, you can mark sections with [Verse] and [Chorus] on their own line — but that's not required at all, plain continuous text works great too."
                    }
                  />
                  <span className="story-field-hint">We’ll produce the song exactly to the words you wrote, without changing them.</span>
                </label>
              )}

              <div className="chip-field">
                <span className="story-field-label">How do you want the song to feel?</span>
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
                    Is there a singer or song you love? <span className="story-field-optional">optional</span>
                    <ChevronDown className={showInspirationField ? "advanced-options-chevron open" : "advanced-options-chevron"} size={14} />
                  </button>
                  {showInspirationField && (
                    <div className="advanced-options-panel">
                      <input
                        onChange={(event) => setField("inspiration", event.target.value)}
                        placeholder="e.g., Ed Sheeran, Taylor Swift, contemporary pop..."
                        value={order.inspiration}
                      />
                      <span className="story-field-hint">We’ll use this as general style inspiration — not to copy an existing song.</span>
                    </div>
                  )}
                </div>
              )}

              {order.musicMode === "reference" && (
                <div className="story-field melody-field">
                  <span className="story-field-label">Do you have a recording to use as inspiration?</span>
                  <span className="story-field-hint">
                    Record or upload a short clip — humming, playing, or any musical idea — and Shirli will use it as
                    inspiration for the song’s mood, tempo, and style.
                  </span>
                  <p className="melody-disclaimer">
                    Good to know: this isn’t an exact copy of the melody — the recording influences the mood, tempo, and
                    style of the new song, it doesn’t replace the original melody.
                  </p>

                  {!order.melodySongId && (
                    <div className="melody-upload-actions">
                      <button className="ghost-button" onClick={() => melodyFileInputRef.current?.click()} type="button">
                        <MusicNote size={16} />
                        Upload recording
                      </button>
                      <button
                        className={isRecordingMelody ? "ghost-button melody-recording" : "ghost-button"}
                        onClick={isRecordingMelody ? stopRecordingMelody : startRecordingMelody}
                        type="button"
                      >
                        <Mic size={16} />
                        {isRecordingMelody ? `Stop recording (${recordingSeconds}s)` : "Record voice"}
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
                      <Loader size={15} /> Uploading the recording...
                    </p>
                  )}

                  {melodyError && <p className="status-message error">{melodyError}</p>}

                  {order.melodySongId && melodyUploadStatus === "ready" && (
                    <div className="melody-preview-card">
                      <p className="melody-ready-label">Your recording is ready ✨</p>
                      {melodyPreviewUrl && <audio controls src={melodyPreviewUrl} />}
                      <div className="melody-preview-actions">
                        <button className="ghost-button" onClick={removeMelody} type="button">
                          <Refresh size={15} />
                          Remove & replace
                        </button>
                      </div>
                      <label className="consent-row">
                        <input
                          checked={order.melodyRightsConfirmed}
                          onChange={(event) => setField("melodyRightsConfirmed", event.target.checked)}
                          type="checkbox"
                        />
                        <span>I confirm this recording is mine, or that I have permission to use it.</span>
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
                More options
                <ChevronDown className={advancedOpen ? "advanced-options-chevron open" : "advanced-options-chevron"} size={14} />
              </button>

              {advancedOpen && (
                <label className="story-field advanced-options-panel">
                  <span className="story-field-label">Is there anything you don’t want in the song?</span>
                  <input
                    onChange={(event) => setField("avoid", event.target.value)}
                    placeholder="e.g., don't mention age, don't use the last name, no impersonating a well-known singer"
                    value={order.avoid}
                  />
                </label>
              )}

              <div className="form-footer">
                <button className="ghost-button" onClick={() => setDecisionMade(false)} type="button">
                  Back
                </button>
                <button className="primary-button" type="button" onClick={() => setStep(2)}>
                  Continue
                  <ArrowLeft className="icon-flip-ltr" size={18} />
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
                  <h3>Just making sure we got it right ✨</h3>
                  <p>Here’s how your song is shaping up. You can confirm or go back and change something.</p>
                </div>
              </div>

              {order.lyricsMode === "auto" && order.story.trim().length < 15 && (
                <p className="confirm-nudge">
                  <AlertTriangle size={15} />
                  Hold on — tell us a bit more so the song can come out more accurate.
                  <button className="confirm-nudge-link" onClick={() => setStep(1)} type="button">
                    Add more details
                  </button>
                </p>
              )}

              <div className="confirm-summary-card">
                <p>{buildConfirmationSummary(order)}</p>
              </div>

              {canPreviewLyrics && (
                <div className="lyrics-draft-preview">
                  <span className="story-field-label">Here’s a preview of the lyrics</span>

                  {!displayLyricsPreview && order.lyricsMode === "auto" && !lyricsPreviewError && (
                    <p className="lyrics-draft-preview-status">Loading the lyrics...</p>
                  )}

                  {!displayLyricsPreview && order.lyricsMode === "auto" && lyricsPreviewError && (
                    <p className="lyrics-draft-preview-status">
                      We couldn’t load a lyrics preview right now — you can still continue.
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
                  Yes, make my song 🎵
                </button>
                <button className="ghost-button" type="button" onClick={() => setStep(1)}>
                  I want to change something
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
                  <h3>Confirm & submit</h3>
                  <p>A few more contact details, then we’ll send it off for production.</p>
                </div>
              </div>

              <div className="field-grid">
                <label>
                  Full name
                  <input
                    required
                    value={order.customerName}
                    onChange={(event) => setField("customerName", event.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Phone
                  <input
                    dir="ltr"
                    required
                    type="tel"
                    value={order.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    placeholder="555-0100"
                  />
                </label>
                <label className="wide">
                  Email
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
                  <span>Song type</span>
                  <strong>{selectedType.label}</strong>
                </div>
                <div>
                  <span>Occasion</span>
                  <strong>{resolvedOccasion || "—"}</strong>
                </div>
                <div>
                  <span>Lyrics</span>
                  <strong>{order.lyricsMode === "custom" ? "Your own lyrics" : "Written with Shirli"}</strong>
                </div>
                <div>
                  <span>Melody</span>
                  <strong>{order.musicMode === "reference" ? "Your recording" : "Created by Shirli"}</strong>
                </div>
                <div>
                  <span>What you get</span>
                  <strong>{orderMode === "demo" ? "A demo to listen to on the site" : "Two versions"}</strong>
                </div>
                {orderMode === "full" && (
                  <div>
                    <span>Song length</span>
                    <strong>{lengthLabelEn(order.songLengthSeconds)}</strong>
                  </div>
                )}
                <div>
                  <span>Cost</span>
                  <strong>{orderMode === "demo" ? "Free" : `${CREDITS_PER_SONG} credits`}</strong>
                </div>
              </div>

              {displayLyricsPreview && (
                <div className="lyrics-draft-preview">
                  <div className="lyrics-draft-preview-heading">
                    <span className="story-field-label">Song lyrics</span>
                    <button className="confirm-nudge-link" onClick={() => setStep(1)} type="button">
                      Edit
                    </button>
                  </div>
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
                </div>
              )}

              <label className="consent-row">
                <input
                  checked={order.consent}
                  required
                  onChange={(event) => setField("consent", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I confirm the details I provided are permitted to use, don’t infringe on anyone’s rights, and that I
                  haven’t requested an impersonation of a protected artist, voice, or song without authorization.
                </span>
              </label>

              {orderMode === "full" && !isAdmin && !hasEnoughCredits ? (
                <div className="insufficient-credits-panel">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>You don’t have enough credits to create this song</strong>
                    <p>Producing a full song requires {CREDITS_PER_SONG} credits.</p>
                    <div className="insufficient-credits-actions">
                      <button onClick={() => handleSelectPlan(singleSongPlan)} type="button">
                        Buy a single song
                      </button>
                      <button onClick={() => (window.location.href = "/pricing?tab=packs")} type="button">
                        View packs
                      </button>
                      <button onClick={() => (window.location.href = "/pricing?tab=subscriptions")} type="button">
                        Join a subscription
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {orderMode === "full" && !isAdmin && (
                    <p className="pay-hint">Producing the full song will use {CREDITS_PER_SONG} credits from your balance.</p>
                  )}
                  <button className="pay-button" disabled={status === "sending"} type="submit">
                    {status === "sending" ? <Loader size={18} /> : <Lock size={18} />}
                    {status === "sending" ? "Creating your song..." : orderMode === "demo" ? "Create free demo" : "Confirm & produce the song"}
                  </button>
                </>
              )}

              {result && (
                <div className="api-result">
                  <CheckCircle size={20} />
                  <div>
                    <strong>{result.mode === "demo" ? "Your demo is ready!" : "Your song is ready!"}</strong>
                    <span>
                      {result.mode === "demo"
                        ? "Listen below — the demo is for on-site listening only."
                        : "Both versions are ready — you can listen, download, and share."}
                    </span>
                    {result.promptPreview && (
                      <div className="lyrics-preview">
                        <span className="lyrics-preview-label">Song lyrics</span>
                        <p>{result.promptPreview}</p>
                      </div>
                    )}
                    {result.versions.some((version) => version.audioDataUrl) && (
                      <div className="audio-delivery">
                        {result.versions.map((version) => (
                          <div className="audio-delivery-version" key={version.label}>
                            {result.versions.length > 1 && <span className="audio-delivery-label">Version {version.label}</span>}
                            {version.audioDataUrl && (
                              <>
                                <audio controls src={version.audioDataUrl}>
                                  Your browser doesn’t support the audio player.
                                </audio>
                                {result.mode === "full" && (
                                  <a download={version.downloadFileName || "custom-song.mp3"} href={version.audioDataUrl}>
                                    Download the song
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
                        <strong>Loved the direction? Your full song is waiting</strong>
                        <p>Get two full versions up to 3 minutes long, ready to download and share.</p>
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
                          Get the full song
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

        <aside className="order-sidebar" aria-label="Your order">
          <button
            aria-controls="order-summary-panel"
            aria-expanded={summaryOpenMobile}
            className="order-summary-toggle"
            onClick={() => setSummaryOpenMobile((v) => !v)}
            type="button"
          >
            <span>Your order</span>
            <span className="order-summary-toggle-end">
              <span className="order-summary-toggle-price">
                {orderMode === "demo" ? "Free" : `${CREDITS_PER_SONG} credits`}
              </span>
              <ChevronDown className="order-summary-toggle-chevron" size={16} />
            </span>
          </button>

          <div className={summaryOpenMobile ? "order-summary-card open" : "order-summary-card"} id="order-summary-panel">
            <h3 className="order-summary-title">Your order</h3>

            <dl className="order-summary-facts">
              <div>
                <dt>Song type</dt>
                <dd>{selectedType.label}</dd>
              </div>
              <div>
                <dt>What you get</dt>
                <dd>{orderMode === "demo" ? "A demo to listen to" : "Two versions"}</dd>
              </div>
              {orderMode === "full" && (
                <div>
                  <dt>Song length</dt>
                  <dd>{lengthLabelEn(order.songLengthSeconds)}</dd>
                </div>
              )}
              <div>
                <dt>Cost</dt>
                <dd>{orderMode === "demo" ? "Free" : `${CREDITS_PER_SONG} credits`}</dd>
              </div>
              <div>
                <dt>Your balance</dt>
                <dd>{isAdmin ? "Unlimited" : `${creditBalance} credits`}</dd>
              </div>
            </dl>

            <div className="order-summary-progress">
              <div className="progress-heading">
                <span>Details completed</span>
                <strong>{completion}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>

            <ul className="order-benefits">
              {[
                "Lyrics confirmed before production",
                "Two different versions to choose from",
                "Audio file ready to download",
                "Personal account area to view your orders",
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
                <span>Admin view — music provider quota</span>
                <span className={isLiveProviderQuota ? "connected-pill" : "connected-pill offline"}>
                  <span className="connected-dot" />
                  {isLiveProviderQuota ? "Connected" : providerQuotaStatus === "loading" ? "Checking" : "Demo mode"}
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
                      <span>Plan</span>
                      <strong>{providerQuota?.tier || "Unknown"}</strong>
                    </div>
                    <div>
                      <span>Used</span>
                      <strong>{formatNumber(providerQuota?.used)}</strong>
                    </div>
                  </div>
                  <div className="admin-quota-footer">
                    <span>{providerQuota?.overageDisabled ? "Overage disabled" : "Overage allowed"}</span>
                    <span>Resets at: {formatReset(providerQuota?.nextReset)}</span>
                  </div>
                </>
              ) : (
                <p className="admin-quota-fallback">
                  {providerQuotaStatus === "loading" ? "Checking connection..." : "No active provider key — demo mode."}
                </p>
              )}
            </div>
          )}
        </aside>
      </section>

      <section className="en-pricing" id="pricing">
        <h2>Pricing</h2>
        <p className="en-pricing-note">
          {CREDITS_PER_SONG} credits = one full song (two audio versions, up to 3 minutes each). Prices are set in ₪
          (ILS); Lemon Squeezy checkout displays and charges in your local currency at checkout.
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

      <section id="legal" className="legal-section">
        <div className="section-intro">
          <p className="eyebrow">Before you start</p>
          <h2>A few important things before you get started.</h2>
        </div>

        <div className="rules-group">
          <h3 className="rules-group-title rules-group-title--good">What you can create</h3>
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
          <h3 className="rules-group-title rules-group-title--bad">What you can’t create</h3>
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
            <h3>Want to see all purchase options?</h3>
            <p>Single song, song packs, or a monthly subscription — all prices and savings in one place.</p>
          </div>
          <Link className="pricing-cta-band-button" href="/pricing">
            <Coin size={18} />
            Go to the pricing page
            <ArrowLeft className="icon-flip-ltr" size={16} />
          </Link>
        </div>
      </section>

      <section id="how" className="process-band" aria-label="How it works">
        <p className="process-band-caption">The process is fully automated — from order to download, with no human involvement.</p>
        <p className="process-band-credit">
          Songs are produced using <span dir="ltr">ElevenLabs Music</span>.
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

      <JsonLd data={englishServiceJsonLd} />

      <SiteFooter locale="en" />

      <a className="scroll-top-fab" href="#top" aria-label="Back to top">
        <ArrowUp size={20} />
      </a>

      {checkoutPlan && <BillingModal account={account} plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />}
    </main>
  );
}
