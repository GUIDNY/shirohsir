"use client";

import { CSSProperties, FormEvent, useMemo, useState } from "react";

type SongType = "gift" | "business" | "graduation";
type OrderStatus = "idle" | "sending" | "ready" | "error";

type OrderPayload = {
  songType: SongType;
  recipient: string;
  occasion: string;
  style: string;
  mood: string;
  vocalist: string;
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
};

type IconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
};

function Glyph({ children, className, size = 18 }: IconProps & { children: string }) {
  return (
    <span
      aria-hidden="true"
      className={className ? `glyph ${className}` : "glyph"}
      style={{ "--glyph-size": `${size}px` } as CSSProperties}
    >
      {children}
    </span>
  );
}

const ArrowLeft = (props: IconProps) => <Glyph {...props}>←</Glyph>;
const BadgeCheck = (props: IconProps) => <Glyph {...props}>✓</Glyph>;
const Check = (props: IconProps) => <Glyph {...props}>✓</Glyph>;
const ChevronLeft = (props: IconProps) => <Glyph {...props}>‹</Glyph>;
const CreditCard = (props: IconProps) => <Glyph {...props}>₪</Glyph>;
const Download = (props: IconProps) => <Glyph {...props}>↓</Glyph>;
const FileText = (props: IconProps) => <Glyph {...props}>≡</Glyph>;
const LoaderCircle = (props: IconProps) => <Glyph {...props}>○</Glyph>;
const LockKeyhole = (props: IconProps) => <Glyph {...props}>●</Glyph>;
const Music = (props: IconProps) => <Glyph {...props}>♪</Glyph>;
const ShieldCheck = (props: IconProps) => <Glyph {...props}>◈</Glyph>;
const SlidersHorizontal = (props: IconProps) => <Glyph {...props}>≋</Glyph>;
const WandSparkles = (props: IconProps) => <Glyph {...props}>✦</Glyph>;

const songTypes: Array<{
  id: SongType;
  label: string;
  description: string;
}> = [
  {
    id: "gift",
    label: "שיר מתנה",
    description: "יום הולדת, זוגיות, חתונה, גיוס, ברכה אישית",
  },
  {
    id: "business",
    label: "שיר לעסק",
    description: "ג'ינגל קצר, קמפיין, מותג, פתיח לסרטון",
  },
  {
    id: "graduation",
    label: "מסיבת סיום",
    description: "גן, בית ספר, צוות, שכבה או טקס סוף שנה",
  },
];

const initialOrder: OrderPayload = {
  songType: "gift",
  recipient: "",
  occasion: "",
  style: "פופ ישראלי קליט",
  mood: "מרגש ושמח",
  vocalist: "זמרת",
  story: "",
  mustInclude: "",
  avoid: "",
  customerName: "",
  email: "",
  phone: "",
  consent: false,
};

const styles = [
  "פופ ישראלי קליט",
  "בלדה מרגשת",
  "ים תיכוני עדין",
  "אקוסטי חם",
  "היפ הופ קליל",
  "ג'ינגל פרסומי",
];

const moods = ["מרגש ושמח", "מצחיק ואישי", "יוקרתי ונקי", "קצבי למסיבה", "נוסטלגי", "ילדותי ומתוק"];
const vocalists = ["זמרת", "זמר", "דואט", "קבוצה", "קול צעיר", "קול בוגר"];

export default function Home() {
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<OrderPayload>(initialOrder);
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [result, setResult] = useState<ApiResult | null>(null);

  const selectedType = songTypes.find((item) => item.id === order.songType) ?? songTypes[0];
  const completion = useMemo(() => {
    const required = [
      order.recipient,
      order.occasion,
      order.style,
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
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="site-shell" dir="rtl">
      <nav className="topbar" aria-label="ניווט ראשי">
        <a className="brand" href="#top" aria-label="מנגינה אישית">
          <span className="brand-mark">
            <Music size={22} strokeWidth={2.4} />
          </span>
          <span>מנגינה אישית</span>
        </a>
        <div className="topbar-actions">
          <a href="#legal">מה מותר</a>
          <a href="#api">חיבור API</a>
          <a className="nav-cta" href="#order">
            הזמנה ב־30 ש״ח
            <ChevronLeft size={16} />
          </a>
        </div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">שירים אישיים בעברית, עם תהליך מכירה מוכן</p>
          <h1>מזמינים סיפור, מקבלים שיר מוכן למכירה.</h1>
          <p className="hero-text">
            אתר מקורי ליצירת שירים לפי פרטים שהלקוח ממלא, עם מחיר ברור של 30 ש״ח,
            אישור תנאים, ותשתית שמוכנה להתחבר לספק מוזיקה חוקי ברגע שיש מפתח API.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#order">
              להתחיל הזמנה
              <ArrowLeft size={18} />
            </a>
            <a className="secondary-link" href="#legal">לראות מגבלות שימוש</a>
          </div>
          <dl className="trust-strip" aria-label="נתוני השירות">
            <div>
              <dt>30 ש״ח</dt>
              <dd>מחיר לשיר אחד</dd>
            </div>
            <div>
              <dt>2 גרסאות</dt>
              <dd>מבנה מוכן למסירה</dd>
            </div>
            <div>
              <dt>API-ready</dt>
              <dd>בלי לנעול ספק</dd>
            </div>
          </dl>
        </div>

        <div className="studio-visual" aria-label="תצוגת שיר">
          <div className="cover-art">
            <span className="pulse-dot" />
            <span className="cover-title">השיר של נועה</span>
            <span className="cover-subtitle">פופ ישראלי · 02:48</span>
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 42 }).map((_, index) => (
                <span key={index} style={{ "--bar": `${18 + ((index * 17) % 62)}%` } as CSSProperties} />
              ))}
            </div>
          </div>
          <div className="player-line">
            <button type="button" aria-label="השמעה לדוגמה">
              <Music size={18} />
            </button>
            <div>
              <strong>טיוטת מילים לאישור</strong>
              <span>נוצרת לפני הפקת האודיו</span>
            </div>
            <Download size={18} />
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
            <span>{number}</span>
            <strong>{text}</strong>
          </div>
        ))}
      </section>

      <section id="order" className="order-section">
        <div className="section-intro">
          <p className="eyebrow">טופס הזמנה</p>
          <h2>כל מה שצריך כדי להפוך פרטים לשיר.</h2>
          <p>
            הזרימה כאן בנויה כדי למכור שיר אחד בכל פעם: בחירת סוג, איסוף פרטים,
            אישור שימוש ותשלום. כרגע התשלום וההפקה במצב הדגמה.
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
                <WandSparkles size={22} />
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
                <FileText size={22} />
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
                  שם הלקוח
                  <input
                    required
                    value={order.customerName}
                    onChange={(event) => setField("customerName", event.target.value)}
                    placeholder="השם שלך"
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
                <CreditCard size={22} />
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
                {status === "sending" ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
                {status === "sending" ? "שולח להזמנה" : "הדמיית הזמנה ב־30 ש\"ח"}
              </button>

              {status === "error" && (
                <p className="status-message error">לא הצלחנו לשלוח כרגע. אפשר לבדוק חיבור API ולנסות שוב.</p>
              )}

              {result && (
                <div className="api-result">
                  <BadgeCheck size={20} />
                  <div>
                    <strong>הזמנה נוצרה: {result.orderId}</strong>
                    <span>
                      מצב: {result.mode === "live" ? "מחובר לספק" : "דמו"} · ספק: {result.provider}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        <aside className="order-sidebar" aria-label="תקציר הזמנה">
          <div className="progress-box">
            <span>שלמות פרטים</span>
            <strong>{completion}%</strong>
            <div className="progress-track">
              <span style={{ width: `${completion}%` }} />
            </div>
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
                <Check size={16} />
                {item}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section id="api" className="api-section">
        <div className="section-intro">
          <p className="eyebrow">תשתית API</p>
          <h2>מוכן לספק מוזיקה, אבל לא תלוי ב־Suno לא רשמי.</h2>
          <p>
            ה־endpoint המקומי מקבל את ההזמנה, בונה פרומפט מסודר ומחזיר Job ID.
            כשיהיה לך ספק מורשה, מחליפים את כתובת ה־API והמפתח בסביבה.
          </p>
        </div>
        <div className="api-grid">
          <div className="api-card">
            <SlidersHorizontal size={22} />
            <h3>Adapter נקי</h3>
            <p>`/api/orders` מרכז את החיבור לספק החיצוני, כך שהטופס לא יודע אם זה דמו, Suno מורשה או ספק אחר.</p>
          </div>
          <div className="api-card">
            <ShieldCheck size={22} />
            <h3>בדיקות שימוש</h3>
            <p>הטופס אוסף אישור זכויות ומונע במפורש בקשות לחיקוי זמרים, שירים קיימים או קולות בלי הסכמה.</p>
          </div>
          <div className="api-card">
            <LockKeyhole size={22} />
            <h3>מוכן לתשלום</h3>
            <p>הכפתור כרגע מדמה הזמנה. בגרסה חיה מחברים סליקה לפני שליחת הבקשה להפקה.</p>
          </div>
        </div>
      </section>

      <section id="legal" className="legal-section">
        <div className="section-intro">
          <p className="eyebrow">מה מותר ומה לא</p>
          <h2>כללי עבודה קצרים לפני שמוכרים שירים.</h2>
        </div>
        <div className="rules-grid">
          <div className="rules-column allowed">
            <h3>מותר בדרך כלל</h3>
            <ul>
              <li>למכור שיר מקורי שנוצר בתוכנית שמעניקה שימוש מסחרי.</li>
              <li>להשתמש בסיפורים, שמות וסלוגנים שהלקוח מוסר ויש לו זכות להשתמש בהם.</li>
              <li>לכתוב מילים מקוריות ולבקש סגנון כללי כמו פופ, בלדה או ג׳ינגל.</li>
              <li>להציג ללקוח תנאים, מגבלות AI וזמן אספקה לפני תשלום.</li>
            </ul>
          </div>
          <div className="rules-column blocked">
            <h3>לא כדאי / אסור בלי אישור</h3>
            <ul>
              <li>לא להעתיק עיצוב, טקסטים, שם, לוגו או נכסים של אתר מתחרה.</li>
              <li>לא לבקש סגנון של אמן מוכר או לחקות קול של אדם אמיתי בלי הסכמה כתובה.</li>
              <li>לא להזין מילים משיר קיים, פלייבק מוגן או חומר של לקוח שאין לו זכויות.</li>
              <li>לא להבטיח זכויות יוצרים רשומות או תוצאה מושלמת ממערכת AI.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
