import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";

export const dynamic = "force-dynamic";

type SubscriptionResponse = {
  tier?: string;
  character_count?: number;
  character_limit?: number;
  max_credit_limit_extension?: number | "unlimited";
  can_extend_character_limit?: boolean;
  current_overage?: {
    amount_cents?: number;
    currency?: string;
  };
  status?: string;
  has_open_invoices?: boolean;
  next_character_count_reset_unix?: number | null;
  currency?: string | null;
  billing_period?: string | null;
};

function cleanApiKey(value: string | undefined) {
  if (!value) {
    return "";
  }

  const withoutEnvName = value.replace(/^\s*(?:ELEVENLABS_API_KEY|ELEVEN_API_KEY|EVEANLABS_API_KEY|API_KEY|XI_API_KEY)\s*=\s*/i, "");
  const withoutWrappingQuotes = withoutEnvName.trim().replace(/^["']|["']$/g, "");

  return withoutWrappingQuotes.replace(/[^\x20-\x7e]/g, "");
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "מנהל בלבד" }, { status: 403 });
  }

  const apiKey = cleanApiKey(
    process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVEN_API_KEY ||
      process.env.EVEANLABS_API_KEY ||
      process.env.API_KEY ||
      process.env.XI_API_KEY,
  );

  if (!apiKey) {
    return NextResponse.json(
      {
        mode: "demo",
        status: "missing_elevenlabs_api_key",
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const providerResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!providerResponse.ok) {
    const providerMessage = await providerResponse.text();

    return NextResponse.json(
      {
        mode: "live",
        status: "provider_error",
        providerStatus: providerResponse.status,
        providerMessage: providerMessage.slice(0, 300),
        updatedAt: new Date().toISOString(),
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const subscription = (await providerResponse.json()) as SubscriptionResponse;
  const used = safeNumber(subscription.character_count);
  const limit = safeNumber(subscription.character_limit);
  const remaining = Math.max(limit - used, 0);
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
