import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { fetchElevenLabsQuota } from "@/lib/song-generation";

export const dynamic = "force-dynamic";

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "מנהל בלבד" }, { status: 403 });
  }

  const quota = await fetchElevenLabsQuota();

  if (!quota.ok && quota.reason === "missing_api_key") {
    return NextResponse.json(
      {
        mode: "demo",
        status: "missing_elevenlabs_api_key",
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!quota.ok) {
    return NextResponse.json(
      {
        mode: "live",
        status: "provider_error",
        providerStatus: quota.providerStatus,
        providerMessage: quota.detail,
        updatedAt: new Date().toISOString(),
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const { subscription, remaining, limit } = quota;
  const used = safeNumber(subscription.character_count);
  const percentUsed = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const nextReset = subscription.next_character_count_reset_unix
    ? new Date(subscription.next_character_count_reset_unix * 1000).toISOString()
    : null;

  return NextResponse.json(
    {
      mode: "live",
      status: subscription.status || "active",
      tier: subscription.tier || "unknown",
      used,
      limit,
      remaining,
      percentUsed,
      maxCreditLimitExtension: subscription.max_credit_limit_extension ?? null,
      canUseOverage: subscription.can_extend_character_limit === true,
      overageDisabled: subscription.max_credit_limit_extension === 0,
      currentOverage: subscription.current_overage ?? null,
      hasOpenInvoices: subscription.has_open_invoices === true,
      nextReset,
      currency: subscription.currency || null,
      billingPeriod: subscription.billing_period || null,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
