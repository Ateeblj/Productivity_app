/**
 * SQL every user must run once in their Supabase SQL Editor.
 * Shown in-app so standalone APK users can copy it without the source repo.
 */
export const SUPABASE_SETUP_SQL = `-- Productivity App — run once in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste all → Run

create table if not exists public.user_data (
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

drop policy if exists "Users can view own data" on public.user_data;
drop policy if exists "Users can insert own data" on public.user_data;
drop policy if exists "Users can update own data" on public.user_data;
drop policy if exists "Users can delete own data" on public.user_data;

create policy "Users can view own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);
`;
