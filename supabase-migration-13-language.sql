-- ============================================================
-- Track the language the order/song was produced in, so the
-- English order flow (Gemini prompt + ElevenLabs style
-- directions) can be selected per-order, including on later
-- revise/extra-version requests against the same order.
-- Existing rows backfill to 'he' automatically via the default.
-- Run: node scripts/migrate.mjs supabase-migration-13-language.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'he';
