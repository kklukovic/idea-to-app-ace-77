CREATE TABLE public.saved_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  idea jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_ideas_user_id_idx ON public.saved_ideas(user_id);

GRANT SELECT, INSERT, DELETE ON public.saved_ideas TO authenticated;
GRANT ALL ON public.saved_ideas TO service_role;

ALTER TABLE public.saved_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own saved ideas" ON public.saved_ideas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own saved ideas" ON public.saved_ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own saved ideas" ON public.saved_ideas
  FOR DELETE USING (auth.uid() = user_id);