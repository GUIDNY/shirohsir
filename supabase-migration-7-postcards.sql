-- ============================================================
-- Attach a photo to a song and share it as a public "postcard" link
-- (photo + player, no login required to view).
-- Run: node scripts/migrate.mjs supabase-migration-7-postcards.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE;

CREATE INDEX IF NOT EXISTS orders_share_token_idx ON public.orders(share_token);
