DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND credits = (SELECT p.credits FROM public.profiles p WHERE p.id = auth.uid())
  AND founder_tier = (SELECT p.founder_tier FROM public.profiles p WHERE p.id = auth.uid())
  AND email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
);