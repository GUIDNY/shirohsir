-- ============================================================
-- Auto-provision a profile + starter credits when someone signs up.
-- Run: node scripts/migrate.mjs supabase-migration-2-signup-trigger.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, delta, reason, note)
  VALUES (NEW.id, 3, 'signup_bonus', 'ברוכים הבאים — 3 קרדיטים לניסיון');

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + 3, updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
