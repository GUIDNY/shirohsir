-- ============================================================
-- Support "יש לי מנגינה" orders — the customer uploads/records their
-- own melody/hum/demo, used as an ElevenLabs Music v2 audio reference
-- (style/production/tempo guidance, not a copy of the reference audio).
-- Also backs "יש לי השראה" (free-text artist/style inspiration), and
-- records which provider/model actually produced the song.
--
-- No raw audio column: ElevenLabs already stores the uploaded
-- reference by song_id, so a duplicate copy in Supabase storage would
-- just be an extra copy of a user's voice/humming recording with no
-- product need for it.
--
-- Run: node scripts/migrate.mjs supabase-migration-12-melody-reference.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS music_mode TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS inspiration TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS melody_song_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS melody_condition_strength TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS melody_rights_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS music_provider TEXT DEFAULT 'elevenlabs',
  ADD COLUMN IF NOT EXISTS music_model TEXT DEFAULT 'music_v2';
