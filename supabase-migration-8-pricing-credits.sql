-- ============================================================
-- Full pricing/credits system: single song, credit packs, monthly
-- subscriptions, a one-time free demo, lot-based credit expiry (FIFO,
-- soonest-to-expire spent first), idempotent grant/spend, and a
-- referral bonus that now pays out on the referred user's first
-- successful purchase instead of at signup.
-- Run: node scripts/migrate.mjs supabase-migration-8-pricing-credits.sql
-- ============================================================

-- ---- new tables ----------------------------------------------------

-- One row per credit "batch" ever granted (purchase, subscription
-- renewal, referral bonus, refund, legacy balance). spend_credits()
-- decrements `remaining` across these, soonest-expiring first, so the
-- cached credit_balances.balance always equals the sum of non-expired
-- `remaining`. Never grant credits by writing credit_ledger directly —
-- always go through grant_credits()/spend_credits() so this stays true.
CREATE TABLE IF NOT EXISTS public.credit_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  source TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_lots_user_id_idx ON public.credit_lots(user_id);
CREATE INDEX IF NOT EXISTS credit_lots_expiry_idx ON public.credit_lots(user_id, expires_at);

-- One row per completed (dummy) checkout — single song, pack, or
-- subscription renewal. Real payment isn't connected yet; this is the
-- record a real payment-provider webhook would eventually write to.
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL, -- 'single_song' | 'pack' | 'subscription'
  product_id TEXT NOT NULL,
  amount_ils NUMERIC(10,2) NOT NULL,
  credits_granted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  payment_provider TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);

-- One free 20-second demo per account, ever.
CREATE TABLE IF NOT EXISTS public.free_demo_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A full song = two musical versions. One row per generated version.
CREATE TABLE IF NOT EXISTS public.song_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  audio_url TEXT,
  credits_cost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS song_versions_order_id_idx ON public.song_versions(order_id);

-- ---- existing table changes -----------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'full', -- 'demo' | 'full'
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_bonus_granted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_demo_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_versions ENABLE ROW LEVEL SECURITY;
-- No anon policies — service-role API routes only, same convention as the rest.

-- ---- backfill: preserve existing balances under lot accounting ------
-- Every account's current cached balance becomes one non-expiring
-- "legacy_balance" lot, so nothing anyone already earned is lost or
-- becomes unspendable once spend_credits() starts walking lots.
INSERT INTO public.credit_lots (user_id, amount, remaining, source, expires_at)
SELECT user_id, balance, balance, 'legacy_balance', NULL
FROM public.credit_balances
WHERE balance > 0
  AND NOT EXISTS (SELECT 1 FROM public.credit_lots WHERE credit_lots.user_id = credit_balances.user_id);

-- ---- functions --------------------------------------------------------

-- grant_credits()/spend_credits() are gaining new trailing parameters.
-- CREATE OR REPLACE only replaces a function with the exact same
-- signature, so without dropping the old 4/5-arg versions first, calls
-- with the old arg count become ambiguous between two overloads.
DROP FUNCTION IF EXISTS public.grant_credits(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.spend_credits(uuid, integer, text, uuid, text);

-- Lazily settles any lots whose expiry has passed: zeroes their
-- `remaining`, logs a 'credits_expired' ledger entry, and syncs the
-- cached balance. Called at the top of spend_credits() and from the
-- wallet read endpoint, so displayed/spendable balance is always
-- correct without needing a cron job.
CREATE OR REPLACE FUNCTION public.settle_expired_credits(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  expired_sum INTEGER;
  current_balance INTEGER;
  next_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(remaining), 0) INTO expired_sum
  FROM public.credit_lots
  WHERE user_id = p_user_id AND remaining > 0 AND expires_at IS NOT NULL AND expires_at <= NOW();

  IF expired_sum > 0 THEN
    UPDATE public.credit_lots
    SET remaining = 0
    WHERE user_id = p_user_id AND remaining > 0 AND expires_at IS NOT NULL AND expires_at <= NOW();

    INSERT INTO public.credit_balances (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO current_balance FROM public.credit_balances WHERE user_id = p_user_id;
    next_balance := GREATEST(current_balance - expired_sum, 0);

    INSERT INTO public.credit_ledger (user_id, delta, reason, note, balance_after)
    VALUES (p_user_id, -expired_sum, 'credits_expired', 'פקיעת קרדיטים', next_balance);

    UPDATE public.credit_balances
    SET balance = next_balance, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant credits (purchase, subscription renewal, referral bonus,
-- refund, legacy signup bonus). Idempotent when p_idempotency_key is
-- given: a repeat call with the same key is a no-op that just returns
-- the current balance, so a retried "payment confirmed" webhook/call
-- can never double-grant. Creates a matching credit_lots row so
-- spend_credits() can account for expiry correctly.
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_note TEXT DEFAULT '',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  next_balance INTEGER;
  existing_ledger_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_ledger_id
    FROM public.credit_ledger
    WHERE idempotency_key = p_idempotency_key;

    IF existing_ledger_id IS NOT NULL THEN
      RETURN current_balance;
    END IF;
  END IF;

  next_balance := current_balance + p_amount;

  INSERT INTO public.credit_lots (user_id, amount, remaining, source, expires_at)
  VALUES (p_user_id, p_amount, p_amount, p_reason, p_expires_at);

  INSERT INTO public.credit_ledger (user_id, delta, reason, note, idempotency_key, expires_at, balance_after)
  VALUES (p_user_id, p_amount, p_reason, p_note, p_idempotency_key, p_expires_at, next_balance);

  UPDATE public.credit_balances
  SET balance = next_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN next_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Spend credits (song production, extra version, revision). Idempotent
-- when p_idempotency_key is given, same guarantee as grant_credits().
-- Settles expired lots first so the balance check is always accurate,
-- then consumes soonest-to-expire lots first (FIFO by expiry, non-
-- expiring lots last). Raises 'insufficient_credits' if the balance
-- (after settling expiry) is too low — never allows a negative balance.
-- Refunds are NOT done by passing a negative amount here — use
-- grant_credits(..., p_reason => 'refund') instead, so the refunded
-- credits become a real (non-expiring) lot rather than silently
-- desyncing credit_lots from the cached balance.
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_order_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT '',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  next_balance INTEGER;
  existing_ledger_id UUID;
  remaining_to_spend INTEGER;
  lot RECORD;
  take INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_ledger_id
    FROM public.credit_ledger
    WHERE idempotency_key = p_idempotency_key;

    IF existing_ledger_id IS NOT NULL THEN
      RETURN current_balance;
    END IF;
  END IF;

  PERFORM public.settle_expired_credits(p_user_id);

  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE user_id = p_user_id;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  next_balance := current_balance - p_amount;
  remaining_to_spend := p_amount;

  FOR lot IN
    SELECT id, remaining
    FROM public.credit_lots
    WHERE user_id = p_user_id AND remaining > 0
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY (expires_at IS NULL), expires_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining_to_spend <= 0;
    take := LEAST(lot.remaining, remaining_to_spend);

    UPDATE public.credit_lots
    SET remaining = remaining - take
    WHERE id = lot.id;

    remaining_to_spend := remaining_to_spend - take;
  END LOOP;

  INSERT INTO public.credit_ledger (user_id, delta, reason, order_id, note, idempotency_key, balance_after)
  VALUES (p_user_id, -p_amount, p_reason, p_order_id, p_note, p_idempotency_key, next_balance);

  UPDATE public.credit_balances
  SET balance = next_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN next_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pays the referral bonus (3 credits to the referrer, 3 to the
-- referred user) the first time the referred user completes any
-- successful purchase (single song, pack, or subscription) — never at
-- signup. The conditional UPDATE ... WHERE referral_bonus_granted =
-- false is the atomic guard against paying twice on a race.
CREATE OR REPLACE FUNCTION public.grant_referral_bonus_if_eligible(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  referrer UUID;
  claimed_referrer UUID;
BEGIN
  SELECT referred_by INTO referrer
  FROM public.profiles
  WHERE id = p_user_id;

  IF referrer IS NULL OR referrer = p_user_id THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET referral_bonus_granted = true
  WHERE id = p_user_id AND referral_bonus_granted = false
  RETURNING referred_by INTO claimed_referrer;

  IF claimed_referrer IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.grant_credits(claimed_referrer, 3, 'referral_bonus', 'חבר שהזמנתם ביצע רכישה ראשונה');
  PERFORM public.grant_credits(p_user_id, 3, 'referred_purchase_bonus', 'בונוס על ההזמנה שהביאה אתכם אלינו');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Signup trigger: creates the profile/referral-code/balance row and
-- records who referred this signup (for the purchase-triggered bonus
-- above). No credits are granted at signup anymore — the free-trial
-- mechanic is the one-time free demo (see free_demo_usage), not
-- free credits, so a new account's balance starts at 0.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_code TEXT;
  referrer_id UUID;
BEGIN
  new_code := upper(substr(replace(NEW.id::text, '-', ''), 1, 8));

  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (NEW.id, NEW.email, new_code)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.raw_user_meta_data ? 'referral_code' AND NEW.raw_user_meta_data->>'referral_code' <> '' THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = upper(NEW.raw_user_meta_data->>'referral_code')
    LIMIT 1;

    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      UPDATE public.profiles SET referred_by = referrer_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
