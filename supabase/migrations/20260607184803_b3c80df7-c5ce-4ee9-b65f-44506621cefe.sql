-- 1. Block direct INSERTs to credit_usage; only service_role can write
CREATE POLICY "Block direct inserts to credit_usage"
ON public.credit_usage
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 2. Allow users to insert their own profile row only
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Atomic credit deduction RPC — prevents TOCTOU race
CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _cost int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  UPDATE public.profiles
  SET credits = credits - _cost
  WHERE id = _user_id AND credits >= _cost
  RETURNING credits INTO remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  RETURN remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, int) TO service_role;

-- Refund helper (atomic add-back if AI call fails after deduction)
CREATE OR REPLACE FUNCTION public.refund_credits(_user_id uuid, _amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = credits + _amount
  WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, int) TO service_role;