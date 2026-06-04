REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, email) ON public.profiles TO authenticated;