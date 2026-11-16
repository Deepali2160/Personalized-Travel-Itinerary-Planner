-- =====================================================================
--  Personalized Travel Itinerary Planner - Supabase schema
--
--  HOW TO RUN: Supabase dashboard -> SQL Editor -> New query ->
--  paste this whole file -> Run. It is safe to run more than once.
--
--  What it creates
--    trips          one row per saved trip (preferences + itinerary as JSON)
--    saved_places   places a user hearted inside an itinerary
--    history        a simple activity log (trip saved / updated / deleted ...)
--
--  Security model
--    * Every table has Row Level Security (RLS) switched ON.
--    * Policies only allow a signed-in user to touch rows where
--      user_id = their own auth.uid(). Nobody can read anyone else's trips.
--    * Only the "authenticated" role gets table privileges. The anonymous
--      (signed-out) role gets nothing.
--    * The browser uses only the PUBLIC publishable/anon key. The secret /
--      service_role key is never needed by this app. Do not put it in the frontend.
--
--  Note on GRANTs: Supabase is changing new projects so that tables in the
--  "public" schema are no longer exposed to the Data API automatically. The
--  explicit GRANT statements below work for both old and new projects.
-- =====================================================================

-- ---------------------------------------------------------------- trips
create table if not exists public.trips (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 160),
  destination          text not null check (char_length(destination) between 1 and 160),
  vibe                 text,
  budget               text,
  start_date           date,
  end_date             date,
  duration_days        integer check (duration_days between 1 and 14),
  total_per_person_inr numeric(14, 2) default 0,
  preferences          jsonb not null,
  itinerary            jsonb not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists trips_user_updated_idx on public.trips (user_id, updated_at desc);

-- ---------------------------------------------------------- saved_places
create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 200),
  description text,
  destination text not null,
  area        text,
  slot        text check (slot in ('morning', 'lunch', 'afternoon', 'evening')),
  cost_inr    integer default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, destination, name)
);

create index if not exists saved_places_user_idx on public.saved_places (user_id, created_at desc);

-- --------------------------------------------------------------- history
create table if not exists public.history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists history_user_idx on public.history (user_id, created_at desc);

-- ------------------------------------------- keep trips.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

-- ============================================ Row Level Security (RLS)
alter table public.trips        enable row level security;
alter table public.saved_places enable row level security;
alter table public.history      enable row level security;

-- trips: full control over your own rows only
drop policy if exists "trips: select own" on public.trips;
drop policy if exists "trips: insert own" on public.trips;
drop policy if exists "trips: update own" on public.trips;
drop policy if exists "trips: delete own" on public.trips;

create policy "trips: select own" on public.trips
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "trips: insert own" on public.trips
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "trips: update own" on public.trips
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trips: delete own" on public.trips
  for delete to authenticated using ((select auth.uid()) = user_id);

-- saved_places: same rule. A place may only point at one of YOUR trips.
drop policy if exists "places: select own" on public.saved_places;
drop policy if exists "places: insert own" on public.saved_places;
drop policy if exists "places: update own" on public.saved_places;
drop policy if exists "places: delete own" on public.saved_places;

create policy "places: select own" on public.saved_places
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "places: insert own" on public.saved_places
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (trip_id is null or exists (
      select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())
    ))
  );
create policy "places: update own" on public.saved_places
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "places: delete own" on public.saved_places
  for delete to authenticated using ((select auth.uid()) = user_id);

-- history: you can read and add your own entries. No edit / delete (it is a log).
drop policy if exists "history: select own" on public.history;
drop policy if exists "history: insert own" on public.history;

create policy "history: select own" on public.history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "history: insert own" on public.history
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ================================================================ GRANTs
-- Signed-out visitors (anon) get nothing; signed-in users get only what the app needs.
revoke all on public.trips        from anon;
revoke all on public.saved_places from anon;
revoke all on public.history      from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.trips        to authenticated;
grant select, insert, update, delete on public.saved_places to authenticated;
grant select, insert                 on public.history      to authenticated;

-- ---------------------------------------------------------------------
-- Quick check after running (optional):
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
--   -> trips, saved_places and history should all show rowsecurity = true
-- ---------------------------------------------------------------------
