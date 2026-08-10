-- ============================================================
-- Support "we already have finished lyrics" orders — the customer
-- pastes the full lyrics themselves instead of the AI writing them
-- from a free-text story.
-- Run: node scripts/migrate.mjs supabase-migration-11-custom-lyrics.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lyrics_mode TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS custom_lyrics TEXT DEFAULT '';
