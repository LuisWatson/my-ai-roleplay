-- Botbaat: per-user cloud storage and the email allowlist.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- Google accounts allowed to use the app. Add yours with the insert at the bottom.
create table if not exists public.allowed_emails (
  email text primary key
);

-- Everything the app used to keep in localStorage, one row per key, per user.
-- Keys: user_custom_chars, user_character_roles, user_roleplay_profile, user_response_settings,
-- user_chat_activity, user_role_prompted, user_gemini_model, chat_history_<characterId>, chat_memory_<characterId>,
-- chat_pins_<characterId>.
create table if not exists public.user_kv (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.allowed_emails enable row level security;
alter table public.user_kv enable row level security;

-- True when the signed-in user's email is on the allowlist. Also called by /api/chat.
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "read own allowlist entry" on public.allowed_emails;
create policy "read own allowlist entry" on public.allowed_emails
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "own rows when allowed" on public.user_kv;
create policy "own rows when allowed" on public.user_kv
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (user_id = (select auth.uid()) and (select public.is_allowed()));

-- Fill in the two Google accounts, then run this line:
-- insert into public.allowed_emails (email) values ('you@gmail.com'), ('partner@gmail.com') on conflict do nothing;
