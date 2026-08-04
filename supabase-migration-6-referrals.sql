-- ============================================================
-- Referral codes + a one-time "share on Facebook" bonus.
-- Run: node scripts/migrate.mjs supabase-migration-6-referrals.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_bonus_claimed BOOLEAN NOT NULL DEFAULT false;

-- Max referral_bonus grants counted per referrer, to bound the payout if
-- someone tries to farm it with throwaway accounts (each still needs a
-- distinct confirmable email, which is real friction, but not zero-cost).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_code TEXT;
  referrer_id UUID;
  referrer_grant_count INTEGER;
BEGIN
  new_code := upper(substr(replace(NEW.id::text, '-', ''), 1, 8));

  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (NEW.id, NEW.email, new_code)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, delta, reason, note)
  VALUES (NEW.id, 3, 'signup_bonus', 'ברוכים הבאים — 3 קרדיטים לניסיון');

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + 3, updated_at = NOW();

  -- Referral: NEW.raw_user_meta_data->>'referral_code' is set client-side
  -- via supabase.auth.signUp({ options: { data: { referral_code } } }).
  IF NEW.raw_user_meta_data ? 'referral_code' AND NEW.raw_user_meta_data->>'referral_code' <> '' THEN
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = upper(NEW.raw_user_meta_data->>'referral_code')
    LIMIT 1;

    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      UPDATE public.profiles SET referred_by = referrer_id WHERE id = NEW.id;

      -- extra bonus for the referred person, on top of the normal signup bonus
      INSERT INTO public.credit_ledger (user_id, delta, reason, note)
      VALUES (NEW.id, 2, 'referred_signup_bonus', 'הצטרפת דרך הזמנה של חבר');
      UPDATE public.credit_balances SET balance = balance + 2, updated_at = NOW() WHERE user_id = NEW.id;

      SELECT count(*) INTO referrer_grant_count
      FROM public.credit_ledger
      WHERE user_id = referrer_id AND reason = 'referral_bonus';

      IF referrer_grant_count < 10 THEN
        INSERT INTO public.credit_balances (user_id, balance)
        VALUES (referrer_id, 0)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.credit_ledger (user_id, delta, reason, note)
        VALUES (referrer_id, 5, 'referral_bonus', 'חבר שהזמנת נרשם');
        UPDATE public.credit_balances SET balance = balance + 5, updated_at = NOW() WHERE user_id = referrer_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
