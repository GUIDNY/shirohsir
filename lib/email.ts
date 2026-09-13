// Transactional emails via Resend's REST API directly — same pattern as
// the ElevenLabs/Gemini calls elsewhere (plain fetch, no SDK dependency).
// Separate from Supabase's own auth emails (signup confirmation,
// password reset), which are configured in the Supabase dashboard, not
// here.

import { SITE_NAME, SITE_NAME_HE, SITE_URL } from "./site-config";

const FROM_ADDRESS = `Shirli <noreply@myshirli.com>`;

function resendApiKey() {
  return process.env.RESEND_API_KEY || "";
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = resendApiKey();

  if (!apiKey || !to) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[RESEND_EMAIL_FAILED] to=${to} subject="${subject}" status=${response.status} detail=${detail.slice(0, 300)}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[RESEND_EMAIL_FAILED] to=${to} subject="${subject}"`, error instanceof Error ? error.message : error);
    return false;
  }
}

function emailShell(bodyHtml: string, language: "he" | "en" = "he"): string {
  const isEnglish = language === "en";
  const footerText = isEnglish
    ? `Sent by ${SITE_NAME} · <a href="${SITE_URL}" style="color:#6d3bd7;">${SITE_URL.replace("https://", "")}</a>`
    : `המייל נשלח מ-${SITE_NAME_HE} · <a href="${SITE_URL}" style="color:#6d3bd7;">${SITE_URL.replace("https://", "")}</a>`;

  return `
    <div dir="${isEnglish ? "ltr" : "rtl"}" style="font-family: Arial, Helvetica, sans-serif; background:#fdf8ff; padding:32px 16px;">
      <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:18px; padding:32px 28px; border:1px solid #ede7f3;">
        <div style="text-align:center; margin-bottom:24px; font-size:22px; font-weight:700; background:linear-gradient(90deg,#6d3bd7,#4a1fa8); -webkit-background-clip:text; background-clip:text; color:transparent;">
          ${isEnglish ? SITE_NAME : SITE_NAME_HE}
        </div>
        ${bodyHtml}
        <div style="margin-top:28px; padding-top:16px; border-top:1px solid #ede7f3; color:#8a8393; font-size:12px; text-align:center;">
          ${footerText}
        </div>
      </div>
    </div>
  `;
}

// Sent right after a paid order successfully produces audio — the
// customer already sees the songs in the browser immediately, this is
// just a durable copy + a nudge to their account page (which serves the
// actual signed-URL downloads; the email itself never embeds the raw
// audio).
export async function sendOrderReadyEmail(params: {
  to: string;
  customerName: string;
  recipient: string;
  occasion: string;
  language?: "he" | "en";
}): Promise<boolean> {
  const { to, customerName, recipient, occasion, language = "he" } = params;

  if (language === "en") {
    const html = emailShell(
      `
      <p style="font-size:16px; color:#1c1b1f; line-height:1.6;">Hi ${escapeHtml(customerName)},</p>
      <p style="font-size:16px; color:#1c1b1f; line-height:1.6;">
        The song for <strong>${escapeHtml(recipient)}</strong> (${escapeHtml(occasion)}) is ready! Both versions are waiting
        in your account — listen, download, and share.
      </p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${SITE_URL}/en#order" style="display:inline-block; background:linear-gradient(90deg,#6d3bd7,#340080); color:#fdf8ff; text-decoration:none; padding:14px 28px; border-radius:999px; font-weight:700;">
          View my song
        </a>
      </div>
    `,
      "en",
    );

    return sendEmail(to, `${recipient}'s song is ready 🎵`, html);
  }

  const html = emailShell(`
    <p style="font-size:16px; color:#1c1b1f; line-height:1.6;">היי ${escapeHtml(customerName)},</p>
    <p style="font-size:16px; color:#1c1b1f; line-height:1.6;">
      השיר של <strong>${escapeHtml(recipient)}</strong> (${escapeHtml(occasion)}) מוכן! שתי הגרסאות מחכות לך
      באזור האישי — אפשר להאזין, להוריד ולשתף.
    </p>
    <div style="text-align:center; margin:28px 0;">
      <a href="${SITE_URL}#order" style="display:inline-block; background:linear-gradient(90deg,#6d3bd7,#340080); color:#fdf8ff; text-decoration:none; padding:14px 28px; border-radius:999px; font-weight:700;">
        לצפייה בשיר שלי
      </a>
    </div>
  `);

  return sendEmail(to, `השיר של ${recipient} מוכן 🎵`, html);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}
