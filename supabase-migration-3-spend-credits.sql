-- ============================================================
-- Atomic credit spend — row-locks the balance so two concurrent
-- orders from the same user can't both read "1 credit left" and
-- both succeed. Raises 'insufficient_credits' if the balance is too
-- low; the caller (API route) catches that and returns 402.
-- Run: node scripts/migrate.mjs supabase-migration-3-spend-credits.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_order_id UUID DEFAULT NULL,
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

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  next_balance := current_balance - p_amount;

  INSERT INTO public.credit_ledger (user_id, delta, reason, order_id, note)
  VALUES (p_user_id, -p_amount, p_reason, p_order_id, p_note);

  UPDATE public.credit_balances
  SET balance = next_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN next_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
