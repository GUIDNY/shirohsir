-- ============================================================
-- Track requested song length now that duration is user-selectable
-- (1 credit = 10 seconds of song).
-- Run: node scripts/migrate.mjs supabase-migration-4-song-length.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS song_length_seconds INTEGER NOT NULL DEFAULT 20;
