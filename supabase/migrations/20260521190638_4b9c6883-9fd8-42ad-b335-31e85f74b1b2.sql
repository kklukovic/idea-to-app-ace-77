
-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  credits integer not null default 100,
  founder_tier text not null default 'founder_47',
  created_at timestamptz not null default now()
);

-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Untitled Project',
  status text not null default 'profile',
  profile_data jsonb,
  manual_research text,
  ideas jsonb,
  scored_ideas jsonb,
  chosen_idea jsonb,
  blueprint_markdown text,
  launch_kit_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id);

-- Credit usage log
create table public.credit_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  action text not null,
  credits_used integer not null,
  ai_model text,
  created_at timestamptz not null default now()
);

create index credit_usage_user_id_idx on public.credit_usage(user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger for projects
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.credit_usage enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users view own projects" on public.projects for select using (auth.uid() = user_id);
create policy "Users insert own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users update own projects" on public.projects for update using (auth.uid() = user_id);
create policy "Users delete own projects" on public.projects for delete using (auth.uid() = user_id);

create policy "Users view own usage" on public.credit_usage for select using (auth.uid() = user_id);
