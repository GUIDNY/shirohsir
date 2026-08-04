-- ============================================================
-- personal-hebrew-song-orders — accounts, subscriptions & credits
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- (or: node scripts/migrate.mjs supabase-schema.sql)
--
-- Model: subscription + pay-as-you-go credit packs, combined.
-- A user's balance is always derived from credit_ledger (append-only,
-- auditable) and mirrored into credit_balances for fast reads.
-- All writes go through service-role API routes — RLS is enabled with
-- no anon policies, matching the my-ski convention.
-- ============================================================

-- One row per authenticated user, mirrors auth.users.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current subscription plan, if any. A user with no row (or status
-- != 'active') is on pay-as-you-go credits only.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  monthly_credit_allowance INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  payment_provider TEXT DEFAULT '',
  payment_provider_ref TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);

-- Append-only ledger — the source of truth for how many credits a
-- user has ever earned or spent, and why. Never UPDATE/DELETE rows;
-- corrections go in as a new offsetting entry.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'subscription_grant' | 'pack_purchase' | 'order_spend' | 'manual_adjustment' | 'refund'
  order_id UUID,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_ledger_user_id_idx ON credit_ledger(user_id);

-- Cached running balance per user, kept in sync with credit_ledger by
-- whatever API route inserts a ledger row (update both in one
-- transaction). Read this for the fast path; recompute from
-- credit_ledger if it's ever suspected to drift.
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per song order. Orders can exist without a user_id for now
-- (anonymous/demo checkout) — make it NOT NULL once accounts are
-- required to place an order.
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  song_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  occasion TEXT NOT NULL,
  style TEXT NOT NULL,
  mood TEXT NOT NULL,
  vocalist TEXT NOT NULL,
  language_register TEXT NOT NULL,
  lyric_structure TEXT NOT NULL,
  pronunciation TEXT DEFAULT '',
  story TEXT NOT NULL,
  must_include TEXT DEFAULT '',
  avoid TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'lyrics_ready' | 'producing' | 'delivered' | 'failed'
  provider TEXT DEFAULT '',
  provider_order_id TEXT DEFAULT '',
  prompt_preview TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  credits_cost INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- No anon policies on any of the above: every read/write goes through
-- service-role API routes (see lib/supabase-server.ts), same as my-ski.
