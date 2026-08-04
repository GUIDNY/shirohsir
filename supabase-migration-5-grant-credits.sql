-- ============================================================
-- Atomic credit grant — mirror of spend_credits() for the add side
-- (signup bonus, pack purchase, subscription renewal). Row-locks the
-- balance the same way, so concurrent grants can't race each other.
-- Run: node scripts/migrate.mjs supabase-migration-5-grant-credits.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  next_balance INTEGER;
BEGIN
  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  next_balance := current_balance + p_amount;

  INSERT INTO public.credit_ledger (user_id, delta, reason, note)
  VALUES (p_user_id, p_amount, p_reason, p_note);

  UPDATE public.credit_balances
  SET balance = next_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN next_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
