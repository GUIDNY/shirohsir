"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
  PlayCircle,
  Refresh,
  Storefront,
} from "./icons";
import { AccountPanel } from "./AccountPanel";
import { useAccount } from "./useAccount";

type SongType = "gift" | "business" | "graduation";
type OrderStatus = "idle" | "sending" | "ready" | "error";

type OrderPayload = {
  songType: SongType;
  recipient: string;
  occasion: string;
  style: string;
  mood: string;
  vocalist: string;
  languageRegister: string;
  lyricStructure: string;
  pronunciation: string;
  story: string;
  mustInclude: string;
  avoid: string;
  customerName: string;
  email: string;
  phone: string;
  consent: boolean;
  songLengthSeconds: number;
};

type ApiResult = {
  orderId: string;
  provider: string;
  status: string;
  mode: "demo" | "live";
  promptPreview: string;
  audioDataUrl?: string;
  audioContentType?: string;
  downloadFileName?: string;
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
  occasion: "",
  style: "פופ ישראלי עכשווי ונקי",
  mood: "מרגש אבל לא כבד",
  vocalist: "זמרת ישראלית חמה",
  languageRegister: "עברית ישראלית מדוברת",
  lyricStructure: "בית קצר ופזמון קליט",
  pronunciation: "",
  story: "",
  mustInclude: "",
  avoid: "",
  customerName: "",
  email: "",
  phone: "",
  consent: false,
  songLengthSeconds: 20,
};

const songLengthOptions = [10, 20, 30, 45, 60];

const styles = [
  "פופ ישראלי עכשווי ונקי",
  "בלדה ישראלית מרגשת",
  "ים תיכוני עדין ומכובד",
  "אקוסטי חם ומשפחתי",
  "היפ הופ ישראלי קליל",
  "ג'ינגל קצר לעסק",
];

const moods = ["מרגש אבל לא כבד", "שמח וקופצני", "מצחיק ואישי", "יוקרתי ונקי", "נוסטלגי וחם", "מתוק לילדים"];
const vocalists = ["זמרת ישראלית חמה", "זמר ישראלי חם", "דואט גבר ואישה", "קולות קבוצה", "קול צעיר ונקי", "קול בוגר ומכובד"];
const languageRegisters = ["עברית ישראלית מדוברת", "עברית חגיגית ונקייה", "עברית קלילה עם סלנג עדין", "עברית לילדים"];
const lyricStructures = ["בית קצר ופזמון קליט", "פזמון פתיחה ישר לעניין", "ג'ינגל עם סלוגן", "ברכה אישית מרגשת"];

const requiredOrderFields: Array<{ key: keyof OrderPayload; label: string }> = [
  { key: "recipient", label: "שם/מותג שעליו השיר" },
  { key: "occasion", label: "אירוע או מטרה" },
  { key: "story", label: "הסיפור" },
  { key: "customerName", label: "שם הלקוח" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
];

const processSteps = [
  { title: "בוחרים סוג שיר", detail: "יום הולדת, חתונה, זוגיות, עסק או כל אירוע אחר." },
  { title: "מספרים את הסיפור", detail: "מוסיפים שמות, זיכרונות, בדיחות ורגעים מיוחדים." },
  { title: "מאשרים את המילים", detail: "עוברים על הטקסט ומבקשים תיקונים לפני הפקת השיר." },
  { title: "מקבלים את השיר", detail: "מורידים את הגרסאות המוכנות ומשתפים עם מי שאוהבים." },
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
  const [order, setOrder] = useState<OrderPayload>(initialOrder);
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [summaryOpenMobile, setSummaryOpenMobile] = useState(false);
  const [providerQuota, setProviderQuota] = useState<ProviderQuotaInfo | null>(null);
  const [providerQuotaStatus, setProviderQuotaStatus] = useState<"loading" | "ready" | "error">("loading");
  const isAdmin = account.credits?.isAdmin === true;
  const isLiveProviderQuota = providerQuotaStatus === "ready" && providerQuota?.mode === "live";
  const accessToken = account.session?.access_token;

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
  const completion = useMemo(() => {
    const required = [
      order.recipient,
      order.occasion,
      order.style,
      order.mood,
      order.vocalist,
      order.languageRegister,
      order.lyricStructure,
      order.story,
      order.customerName,
      order.email,
      order.phone,
    ];
    const filled = required.filter((value) => value.trim().length > 0).length;
    return Math.round((filled / required.length) * 100);
  }, [order]);

  // Drives both the order form's own step tabs and the marketing process
  // band above it — real state, not a fixed/decorative indicator: the
  // form's step (0/1/2) maps directly to process steps 0/1/2, and a
  // delivered result bumps it to the final "מקבלים את השיר" step.
  const activeProcessIndex = result ? 3 : step;

  const setField = <K extends keyof OrderPayload>(key: K, value: OrderPayload[K]) => {
    setOrder((current) => ({ ...current, [key]: value }));
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setOrderError(null);

    const missingField = requiredOrderFields.find(({ key }) => !order[key]?.toString().trim());

    if (missingField) {
      setStep(1);
      setOrderError(`חסר פרט: "${missingField.label}". אפשר להשלים אותו בשלב "מספרים את הסיפור".`);
      setStatus("error");
      return;
    }

    setStatus("sending");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (account.session?.access_token) {
        headers.Authorization = `Bearer ${account.session.access_token}`;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(order),
      });

      if (response.status === 402) {
        setOrderError("היתרה שלכם לא מספיקה ליצירת שיר נוסף כרגע. אפשר להוסיף יתרה מתפריט המשתמש.");
        setStatus("error");
        return;
      }

      if (response.status === 400) {
        setStep(1);
        setOrderError('חסרים פרטים בטופס — אפשר לעבור על שלב "מספרים את הסיפור" ולוודא שהכול מלא.');
        setStatus("error");
        return;
      }

      if (!response.ok) {
        throw new Error("Order request failed");
      }

      const data = (await response.json()) as ApiResult;
      setResult(data);
      setStatus("ready");
      setStep(2);
      void account.refreshCredits();
      void refreshProviderQuota();
    } catch {
      setOrderError("לא הצלחנו להשלים את הפעולה כרגע. אפשר לנסות שוב בעוד מספר דקות.");
      setStatus("error");
    }
  };

  return (
    <main className="site-shell" dir="rtl">
      <nav className="topbar" aria-label="ניווט ראשי">
        <div className="topbar-start">
          <a className="brand" href="#top" aria-label="מנגינה אישית">
            <span className="brand-mark">
              <MusicNote size={20} strokeWidth={2.1} />
            </span>
            <span>מנגינה אישית</span>
          </a>

          <div className="topbar-actions">
            <a href="#how">איך זה עובד</a>
            <a href="#legal">מה מותר</a>
          </div>
        </div>

        <div className="topbar-end">
          {isAdmin && (
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
          )}
          <a className="nav-cta" href="#order">
            <Plus size={16} />
            שיר חדש
          </a>
          <AccountPanel account={account} />
        </div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            שירים אישיים בעברית, מוכנים תוך דקות
          </p>
          <h1>הופכים את הסיפור שלכם לשיר אישי.</h1>
          <p className="hero-text">
            ספרו לנו על האדם, האירוע והרגעים החשובים. אנחנו נכתוב, נלחין ונפיק עבורכם שיר מקורי ומרגש,
            מוכן לשיתוף ולהורדה.
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
              <dt>שיר אישי ב-30 ₪</dt>
              <dd>מחיר קבוע וברור, ללא הפתעות.</dd>
            </div>
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
          <div className="record-sleeve">
            <div className="vinyl-stage">
              <span className="vinyl-ring" aria-hidden="true" />
              <span className="vinyl-ring vinyl-ring--outer" aria-hidden="true" />
              <div className="vinyl-disc">
                <span className="tone-arm" aria-hidden="true" />
                <div className="disc-label">
                  <span className="spindle-hole" />
                  <strong className="cover-title">השיר של נועה</strong>
                  <span className="cover-subtitle">פופ ישראלי</span>
                </div>
              </div>
            </div>
          </div>

          <div className="player-line">
            <span className="player-icon">
              <Lyrics size={20} />
            </span>
            <div>
              <strong>טיוטת מילים לאישור</strong>
              <span>נשלחת אליכם לפני שהשיר מופק</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="process-band" aria-label="איך זה עובד">
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
          <div className="steps" aria-label="התקדמות ביצירת השיר">
            {["סוג שיר", "הסיפור", "סיכום"].map((label, index) => (
              <button
                className={step === index ? "active" : ""}
                key={label}
                type="button"
                onClick={() => setStep(index)}
              >
                <span>{step > index ? <CheckSmall size={13} /> : index + 1}</span>
                {label}
              </button>
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

              <div className="length-picker">
                <span className="length-picker-label">אורך השיר</span>
                <div className="length-grid">
                  {songLengthOptions.map((seconds) => (
                    <label
                      className={order.songLengthSeconds === seconds ? "length-card selected" : "length-card"}
                      key={seconds}
                    >
                      <input
                        checked={order.songLengthSeconds === seconds}
                        name="songLengthSeconds"
                        onChange={() => setField("songLengthSeconds", seconds)}
                        type="radio"
                      />
                      <strong>{seconds} שנ&apos;</strong>
                    </label>
                  ))}
                </div>
              </div>

              <button className="primary-button" type="button" onClick={() => setStep(1)}>
                ממשיכים לסיפור
                <ArrowLeft size={18} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="form-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <Edit size={18} />
                </span>
                <div>
                  <h3>{selectedType.label}: מספרים את הסיפור</h3>
                  <p>ככל שהפרטים מדויקים יותר, השיר יישמע אישי יותר.</p>
                </div>
              </div>

              <div className="field-grid">
                <label>
                  שם/מותג שעליו השיר
                  <input
                    required
                    value={order.recipient}
                    onChange={(event) => setField("recipient", event.target.value)}
                    placeholder="לדוגמה: נועה / קפה אריאל / שכבת ו'"
                  />
                </label>
                <label>
                  אירוע או מטרה
                  <input
                    required
                    value={order.occasion}
                    onChange={(event) => setField("occasion", event.target.value)}
                    placeholder="יום הולדת 40, ג'ינגל לפתיחה, מסיבת סיום"
                  />
                </label>
                <label>
                  סגנון מוזיקלי
                  <select value={order.style} onChange={(event) => setField("style", event.target.value)}>
                    {styles.map((style) => (
                      <option key={style}>{style}</option>
                    ))}
                  </select>
                </label>
                <label>
                  רגש מוביל
                  <select value={order.mood} onChange={(event) => setField("mood", event.target.value)}>
                    {moods.map((mood) => (
                      <option key={mood}>{mood}</option>
                    ))}
                  </select>
                </label>
                <label>
                  מי שר
                  <select value={order.vocalist} onChange={(event) => setField("vocalist", event.target.value)}>
                    {vocalists.map((voice) => (
                      <option key={voice}>{voice}</option>
                    ))}
                  </select>
                </label>
                <label>
                  סוג העברית
                  <select
                    value={order.languageRegister}
                    onChange={(event) => setField("languageRegister", event.target.value)}
                  >
                    {languageRegisters.map((register) => (
                      <option key={register}>{register}</option>
                    ))}
                  </select>
                </label>
                <label>
                  מבנה מילים
                  <select
                    value={order.lyricStructure}
                    onChange={(event) => setField("lyricStructure", event.target.value)}
                  >
                    {lyricStructures.map((structure) => (
                      <option key={structure}>{structure}</option>
                    ))}
                  </select>
                </label>
                <label>
                  שם הלקוח
                  <input
                    required
                    value={order.customerName}
                    onChange={(event) => setField("customerName", event.target.value)}
                    placeholder="השם שלך"
                  />
                </label>
                <label className="wide">
                  הגייה לשירה
                  <input
                    value={order.pronunciation}
                    onChange={(event) => setField("pronunciation", event.target.value)}
                    placeholder="למשל: סקי שייר (לשם באנגלית)"
                  />
                </label>
                <label className="wide">
                  הסיפור
                  <textarea
                    required
                    value={order.story}
                    onChange={(event) => setField("story", event.target.value)}
                    placeholder="ספרו בכמה משפטים על האדם, העסק או הכיתה. רגעים מצחיקים, מילים חשובות, או מסר שצריך להישאר."
                  />
                </label>
                <label className="wide">
                  מה חייב להיכנס?
                  <textarea
                    value={order.mustInclude}
                    onChange={(event) => setField("mustInclude", event.target.value)}
                    placeholder="שמות, סלוגן, מקומות, הגייה נכונה, משפטים פנימיים"
                  />
                </label>
                <label className="wide">
                  מה לא להזכיר?
                  <input
                    value={order.avoid}
                    onChange={(event) => setField("avoid", event.target.value)}
                    placeholder="למשל: לא להזכיר גיל, לא להשתמש בשם משפחה, בלי חיקוי זמר מוכר"
                  />
                </label>
                <label>
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
              </div>

              <div className="form-footer">
                <button className="ghost-button" type="button" onClick={() => setStep(0)}>
                  חזרה
                </button>
                <button className="primary-button" type="button" onClick={() => setStep(2)}>
                  לסיכום ההזמנה
                  <ArrowLeft size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-panel summary-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <CheckCircle size={18} />
                </span>
                <div>
                  <h3>מאשרים ושולחים</h3>
                  <p>עוברים על הפרטים, מאשרים את תנאי השימוש, ושולחים ליצירה.</p>
                </div>
              </div>
              <div className="summary-grid">
                <div>
                  <span>סוג השיר</span>
                  <strong>{selectedType.label}</strong>
                </div>
                <div>
                  <span>סגנון</span>
                  <strong>{order.style}</strong>
                </div>
                <div>
                  <span>אורך</span>
                  <strong>{order.songLengthSeconds} שניות</strong>
                </div>
                <div>
                  <span>מחיר כולל</span>
                  <strong>30 ₪</strong>
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

              <button className="pay-button" disabled={status === "sending"} type="submit">
                {status === "sending" ? <Loader size={18} /> : <Lock size={18} />}
                {status === "sending" ? "יוצרים את השיר..." : 'יצירת השיר ב-30 ש"ח'}
              </button>

              {result && (
                <div className="api-result">
                  <CheckCircle size={20} />
                  <div>
                    <strong>ההזמנה נשמרה בהצלחה!</strong>
                    <span>
                      {result.audioDataUrl
                        ? "השיר שלכם מוכן — אפשר להאזין ולהוריד למטה."
                        : "נמשיך לעדכן אתכם באזור האישי ברגע שהשיר מוכן."}
                    </span>
                    {result.promptPreview && (
                      <div className="lyrics-preview">
                        <span className="lyrics-preview-label">מילות השיר</span>
                        <p>{result.promptPreview}</p>
                      </div>
                    )}
                    {result.audioDataUrl && (
                      <div className="audio-delivery">
                        <audio controls src={result.audioDataUrl}>
                          הדפדפן שלך לא תומך בנגן אודיו.
                        </audio>
                        <a download={result.downloadFileName || "custom-song.mp3"} href={result.audioDataUrl}>
                          להורדת השיר
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
              <span className="order-summary-toggle-price">30 ₪</span>
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
                <dt>אורך</dt>
                <dd>{order.songLengthSeconds} שניות</dd>
              </div>
              <div>
                <dt>מה מקבלים</dt>
                <dd>שתי גרסאות</dd>
              </div>
              <div>
                <dt>מחיר כולל</dt>
                <dd>30 ₪</dd>
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

      <a className="scroll-top-fab" href="#top" aria-label="חזרה לראש העמוד">
        <ArrowUp size={20} />
      </a>
    </main>
  );
}
