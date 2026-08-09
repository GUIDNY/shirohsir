-- ============================================================
-- Track the recipient's grammatical gender so Hebrew lyric
-- templates can pick correctly-gendered pronoun forms
-- (e.g. "עלייך" vs "עליך") instead of always defaulting to
-- masculine.
-- Run: node scripts/migrate.mjs supabase-migration-9-recipient-gender.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_gender TEXT NOT NULL DEFAULT 'male';
