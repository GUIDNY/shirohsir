-- ============================================================
-- Real Lemon Squeezy webhook integration: idempotent webhook
-- processing table + a way to map a subscription-related webhook
-- (renewal/cancel/expire/payment-failed) back to our own
-- subscriptions row and user.
-- Run: node scripts/migrate.mjs supabase-migration-10-lemonsqueezy.sql
-- ============================================================

-- One row per successfully-processed webhook delivery, keyed by
-- "{event_name}:{data.id}" (see app/api/webhooks/lemonsqueezy/route.ts).
-- Checked before any event-specific logic runs — a duplicate delivery
-- (Lemon Squeezy retries until it gets a 200) short-circuits to a plain
-- 200 with no further action, instead of double-crediting.
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id TEXT UNIQUE;

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
-- No anon policies — service-role webhook handler only, same convention as the rest.
