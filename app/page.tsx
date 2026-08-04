"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Album,
  Api,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bolt,
  CheckCircle,
  CheckSmall,
  Coin,
  Copy,
  CreditCard,
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
  ShieldCheck,
  Storefront,
} from "./icons";

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

type CreditsInfo = {
  mode: "demo" | "live";
  status: string;
  tier?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  percentUsed?: number;
  overageDisabled?: boolean;
  nextReset?: string | null;
  updatedAt?: string;
};

const songTypes: Array<{
  id: SongType;
  label: string;
  description: string;
  icon: typeof Gift;
}> = [
  {
    id: "gift",
    label: "שיר מתנה",
    description: "יום הולדת, זוגיות, חתונה, גיוס, ברכה אישית",
    icon: Gift,
  },
  {
    id: "business",
    label: "שיר לעסק",
    description: "ג'ינגל קצר, קמפיין, מותג, פתיח לסרטון",
    icon: Storefront,
  },
  {
    id: "graduation",
    label: "מסיבת סיום",
    description: "גן, בית ספר, צוות, שכבה או טקס סוף שנה",
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
};

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
const numberFormatter = new Intl.NumberFormat("he-IL");

const allowedRules = [
  {
    icon: CheckCircle,
    title: "שימוש מסחרי מורשה",
    detail: "למכור שיר מקורי שנוצר בתוכנית שמעניקה שימוש מסחרי.",
  },
  {
    icon: Edit,
    title: "תוכן מקורי של הלקוח",
    detail: "להשתמש בסיפורים, שמות וסלוגנים שהלקוח מוסר ויש לו זכות להשתמש בהם.",
  },
  {
    icon: MusicNote,
    title: "סגנון מקורי",
    detail: "לכתוב מילים מקוריות ולבקש סגנון כללי כמו פופ, בלדה או ג׳ינגל.",
  },
  {
    icon: ShieldCheck,
    title: "שקיפות לפני תשלום",
    detail: "להציג ללקוח תנאים, מגבלות AI וזמן אספקה לפני תשלום.",
  },
];

const blockedRules = [
  {
    icon: Copy,
    title: "העתקת נכסים",
    detail: "לא להעתיק עיצוב, טקסטים, שם, לוגו או נכסים של אתר מתחרה.",
  },
  {
    icon: Mic,
    title: "חיקוי ללא הסכמה",
    detail: "לא לבקש סגנון של אמן מוכר או לחקות קול של אדם אמיתי בלי הסכמה כתובה.",
  },
  {
    icon: Lock,
    title: "חומר מוגן בזכויות",
    detail: "לא להזין מילים משיר קיים, פלייבק מוגן או חומר של לקוח שאין לו זכויות.",
  },
  {
    icon: AlertTriangle,
    title: "הבטחות מוגזמות",
    detail: "לא להבטיח זכויות יוצרים רשומות או תוצאה מושלמת ממערכת AI.",
  },
];

const apiCards = [
  {
    icon: CreditCard,
    title: "מוכן לתשלום",
    detail: "הכפתור כרגע מדמה הזמנה. בגרסה חיה מחברים סליקה לפני שליחת הבקשה להפקה.",
  },
  {
    icon: ShieldCheck,
    title: "בדיקות שימוש",
    detail: "הטופס אוסף אישור זכויות ומונע במפורש בקשות לחיקוי זמרים, שירים קיימים או קולות בלי הסכמה.",
  },
  {
    icon: Lock,
    title: "Adapter נקי",
    detail: "`/api/orders` מרכז את החיבור לספק החיצוני, כך שהטופס לא יודע אם זה דמו, Suno מורשה או ספק אחר.",
  },
];

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
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<OrderPayload>(initialOrder);
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [creditsStatus, setCreditsStatus] = useState<"loading" | "ready" | "error">("loading");
  const isLiveCredits = creditsStatus === "ready" && credits?.mode === "live";

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

  const setField = <K extends keyof OrderPayload>(key: K, value: OrderPayload[K]) => {
    setOrder((current) => ({ ...current, [key]: value }));
  };

  const refreshCredits = useCallback(async () => {
    try {
      const response = await fetch("/api/credits", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Credits request failed");
      }

      const data = (await response.json()) as CreditsInfo;
      setCredits(data);
      setCreditsStatus("ready");
    } catch {
      setCreditsStatus("error");
    }
  }, []);

  useEffect(() => {
    void refreshCredits();
    const interval = window.setInterval(() => void refreshCredits(), 30000);

    return () => window.clearInterval(interval);
  }, [refreshCredits]);

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setResult(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error("Order request failed");
      }

      const data = (await response.json()) as ApiResult;
      setResult(data);
      setStatus("ready");
      setStep(2);
      void refreshCredits();
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="site-shell" dir="rtl">
      <nav className="topbar" aria-label="ניווט ראשי">
        <a className="brand" href="#top" aria-label="מנגינה אישית">
          <span className="brand-mark">
            <MusicNote size={20} strokeWidth={2.1} />
          </span>
          <span>מנגינה אישית</span>
        </a>

        <div className="topbar-actions">
          <a href="#api">חיבור API</a>
          <a href="#legal">מה מותר</a>
        </div>

        <div className="topbar-end">
          <div className="credit-pill" aria-live="polite">
            <span>קרדיטים:</span>
            <strong>
              {creditsStatus === "loading"
                ? "בודק..."
                : creditsStatus === "error"
                  ? "לא זמין"
                  : formatNumber(credits?.remaining)}
            </strong>
            <Coin size={16} className="coin-icon" />
            <button type="button" onClick={refreshCredits} aria-label="רענון קרדיטים">
              <Refresh size={13} />
            </button>
          </div>
          <a className="nav-cta" href="#order">
            הזמנה ב־30 ש״ח
            <ArrowLeft size={16} />
          </a>
        </div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            שירים אישיים בעברית • תהליך מכירה מוכן
          </p>
          <h1>
            מזמינים <em>סיפור</em>,
            <br />
            מקבלים שיר
            <br />
            <span className="accent-text">מוכן למכירה.</span>
          </h1>
          <p className="hero-text">
            אתר מקורי ליצירת שירים לפי פרטים שהלקוח ממלא, עם מחיר ברור של 30 ש״ח,
            אישור תנאים, ותשתית שמוכנה להתחבר לספק מוזיקה חוקי ברגע שיש מפתח API.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#order">
              <PlayCircle size={20} />
              להתחיל הזמנה
            </a>
            <a className="secondary-link" href="#legal">
              לראות מגבלות שימוש
            </a>
          </div>
          <dl className="trust-strip" aria-label="נתוני השירות">
            <div>
              <span className="trust-icon">
                <CreditCard size={18} />
              </span>
              <dt>30 ש״ח</dt>
              <dd>מחיר פיקס לשיר אחד</dd>
            </div>
            <div>
              <span className="trust-icon">
                <MusicNote size={18} />
              </span>
              <dt>2 גרסאות</dt>
              <dd>מבנה מוכן למסירה מיידית</dd>
            </div>
            <div>
              <span className="trust-icon">
                <Api size={18} />
              </span>
              <dt>API-ready</dt>
              <dd>תשתית גמישה, בלי לנעול ספק</dd>
            </div>
          </dl>
        </div>

        <div className="studio-visual" aria-label="תצוגת שיר">
          <div className="record-sleeve">
            <div className="sleeve-topline">
              <span className="catalog-code">SR·01 // CUSTOM AUDIO</span>
              <Album size={18} />
            </div>

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
              <span>נוצרת לפני הפקת האודיו</span>
            </div>
            <span className="player-action" aria-hidden="true">
              <ArrowDown size={16} />
            </span>
          </div>
        </div>
      </section>

      <section className="process-band" aria-label="שלבי השירות">
        {[
          ["01", "הלקוח ממלא סיפור"],
          ["02", "תשלום מאובטח"],
          ["03", "מילים לאישור"],
          ["04", "הפקה והורדה"],
        ].map(([number, text]) => (
          <div className="process-item" key={number}>
            <strong>{text}</strong>
            <span>{number}</span>
          </div>
        ))}
      </section>

      <section id="order" className="order-section">
        <div className="section-intro">
          <p className="eyebrow">
            <Bolt size={13} />
            תהליך יצירה חכם
          </p>
          <h2>
            כל מה שצריך כדי
            <br />
            <span className="accent-text-alt">להפוך פרטים לשיר.</span>
          </h2>
          <p>
            הזרימה כאן בנויה כדי למכור שיר אחד בכל פעם: בחירת סוג, איסוף פרטים,
            אישור שימוש ותשלום. ההפקה מחוברת ל־ElevenLabs כשיש מפתח פעיל; התשלום עדיין במצב הדגמה.
          </p>
        </div>

        <form className="order-tool" onSubmit={submitOrder}>
          <div className="steps" aria-label="התקדמות">
            {["סוג שיר", "פרטים", "סיכום"].map((label, index) => (
              <button
                className={step === index ? "active" : ""}
                key={label}
                type="button"
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div className="form-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <MusicNote size={18} />
                </span>
                <div>
                  <h3>איזה שיר יוצרים?</h3>
                  <p>בחר סוג הזמנה כדי להתאים את השאלות ואת הפרומפט.</p>
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
                    <span className="type-card-icon">
                      <type.icon size={22} />
                    </span>
                    <strong>{type.label}</strong>
                    <span>{type.description}</span>
                  </label>
                ))}
              </div>
              <button className="primary-button" type="button" onClick={() => setStep(1)}>
                ממשיכים לפרטים
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
                  <h3>{selectedType.label}: פרטים לכתיבה</h3>
                  <p>ככל שהפרטים מדויקים יותר, השיר נשמע פחות גנרי.</p>
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
                    placeholder="כתיב עברי לשם הראשי. למשל: SkiShare = סקי שייר"
                  />
                </label>
                <label className="wide">
                  הסיפור
                  <textarea
                    required
                    value={order.story}
                    onChange={(event) => setField("story", event.target.value)}
                    placeholder="ספר בכמה משפטים על האדם, העסק או הכיתה. רגעים מצחיקים, מילים חשובות, או מסר שצריך להישאר."
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
                  לסיכום ותשלום
                  <ArrowLeft size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-panel summary-panel">
              <div className="panel-heading">
                <span className="panel-icon">
                  <CreditCard size={18} />
                </span>
                <div>
                  <h3>סיכום לפני חיוב</h3>
                  <p>בגרסה חיה מחברים כאן Stripe, PayPlus, משולם או ספק סליקה ישראלי.</p>
                </div>
              </div>
              <div className="summary-grid">
                <div>
                  <span>חבילה</span>
                  <strong>שיר אחד בהתאמה אישית</strong>
                </div>
                <div>
                  <span>סוג</span>
                  <strong>{selectedType.label}</strong>
                </div>
                <div>
                  <span>סגנון</span>
                  <strong>{order.style}</strong>
                </div>
                <div>
                  <span>עברית</span>
                  <strong>{order.languageRegister}</strong>
                </div>
                <div>
                  <span>מחיר</span>
                  <strong>30 ש״ח</strong>
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
                {status === "sending" ? "שולח להזמנה" : "הדמיית הזמנה ב־30 ש\"ח"}
              </button>

              {status === "error" && (
                <p className="status-message error">לא הצלחנו לשלוח כרגע. אפשר לבדוק חיבור API ולנסות שוב.</p>
              )}

              {result && (
                <div className="api-result">
                  <CheckCircle size={20} />
                  <div>
                    <strong>הזמנה נוצרה: {result.orderId}</strong>
                    <span>
                      מצב: {result.mode === "live" ? "מחובר לספק" : "דמו"} · ספק: {result.provider}
                    </span>
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

        <aside className="order-sidebar" aria-label="תקציר הזמנה">
          <div className="progress-box">
            <div className="progress-heading">
              <span>שלמות פרטים</span>
              <strong>{completion}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="voice-engine-card">
            <div className="voice-engine-heading">
              <span className="voice-engine-name">
                מנוע קולי
                <strong>ElevenLabs</strong>
              </span>
              <span className={isLiveCredits ? "connected-pill" : "connected-pill offline"}>
                <span className="connected-dot" />
                {isLiveCredits ? "מחובר" : creditsStatus === "loading" ? "בודק" : "מצב הדגמה"}
              </span>
            </div>

            {isLiveCredits ? (
              <>
                <span className="voice-engine-label">תווים נותרים לחודש</span>
                <div className="voice-engine-stat">
                  <span>{formatCompact(credits?.limit)} /</span>
                  <strong>{formatCompact(credits?.remaining)}</strong>
                </div>
                <div className="voice-engine-track">
                  <span style={{ width: `${credits?.percentUsed ?? 0}%` }} />
                </div>
                <div className="voice-engine-grid">
                  <div>
                    <span>תוכנית</span>
                    <strong>{credits?.tier || "לא ידוע"}</strong>
                  </div>
                  <div>
                    <span>נוצל</span>
                    <strong>{formatNumber(credits?.used)}</strong>
                  </div>
                </div>
                <div className="voice-engine-footer">
                  <span>{credits?.overageDisabled ? "חריגה כבויה" : "חריגה אפשרית"}</span>
                  <span>איפוס ב: {formatReset(credits?.nextReset)}</span>
                </div>
              </>
            ) : (
              <p className="voice-engine-fallback">
                {creditsStatus === "loading" ? "בודק חיבור ל-ElevenLabs..." : "אין מפתח ElevenLabs פעיל — מצב הדגמה."}
              </p>
            )}
          </div>

          <div className="price-box">
            <span>תשלום ללקוח</span>
            <strong>30 ש״ח</strong>
            <p>כדי להרוויח, העלות שלך להפקה+סליקה+תמיכה חייבת להיות נמוכה מזה.</p>
          </div>

          <div className="checklist-box">
            {[
              "מילים לאישור לפני הפקה",
              "שתי גרסאות אודיו",
              "אזור אישי בהמשך",
              "Webhook מספק מוזיקה",
            ].map((item) => (
              <span key={item}>
                <CheckSmall size={15} />
                {item}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section id="api" className="api-section">
        <div className="section-intro">
          <p className="eyebrow">
            <Api size={13} />
            תשתית API
          </p>
          <h2>
            מוכן לספק מוזיקה,
            <br />
            <span className="accent-text">אבל לא תלוי ב־Suno לא רשמי.</span>
          </h2>
          <p>
            ה־endpoint המקומי מקבל את ההזמנה, בונה פרומפט עברי מדויק ומחזיר קובץ MP3 לניגון והורדה.
            במקביל האתר קורא את מצב הקרדיטים מ־ElevenLabs ומעדכן אותו אוטומטית.
          </p>
        </div>
        <div className="api-grid">
          {apiCards.map((card) => (
            <div className="api-card" key={card.title}>
              <span className="api-card-icon">
                <card.icon size={20} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="legal" className="legal-section">
        <div className="section-intro">
          <p className="eyebrow">מה מותר ומה לא</p>
          <h2>כללי עבודה קצרים לפני שמוכרים שירים.</h2>
        </div>
        <div className="rules-grid">
          <div className="rules-column allowed">
            <div className="rules-column-heading">
              <h3>מותר בדרך כלל</h3>
              <span className="rules-badge good">
                <CheckSmall size={14} />
              </span>
            </div>
            <div className="rules-list">
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
          <div className="rules-column blocked">
            <div className="rules-column-heading">
              <h3>אסור בלי אישור</h3>
              <span className="rules-badge bad">✕</span>
            </div>
            <div className="rules-list">
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
        </div>
      </section>

      <a className="scroll-top-fab" href="#top" aria-label="חזרה לראש העמוד">
        <ArrowUp size={20} />
      </a>
    </main>
  );
}
