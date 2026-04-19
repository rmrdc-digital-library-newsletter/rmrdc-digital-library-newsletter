-- RMRDC Digital Library setup
-- Run this in the Supabase SQL editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text not null,
  type text not null,
  year int not null,
  abstract text,
  cover_url text not null,
  pdf_url text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.view_events (
  id bigserial primary key,
  publication_id uuid not null references public.publications(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_agent text
);

create table if not exists public.download_events (
  id bigserial primary key,
  publication_id uuid not null references public.publications(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_agent text
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_publications_updated_at on public.publications;
create trigger trg_publications_updated_at
  before update on public.publications
  for each row execute procedure public.set_updated_at();

create or replace view public.publications_with_stats as
select
  p.*,
  coalesce(v.view_count, 0)::int as view_count,
  coalesce(d.download_count, 0)::int as download_count
from public.publications p
left join (
  select publication_id, count(*) as view_count
  from public.view_events
  group by publication_id
) v on v.publication_id = p.id
left join (
  select publication_id, count(*) as download_count
  from public.download_events
  group by publication_id
) d on d.publication_id = p.id;

alter table public.profiles enable row level security;
alter table public.publications enable row level security;
alter table public.view_events enable row level security;
alter table public.download_events enable row level security;

-- Public read access for the library.
drop policy if exists "public read publications" on public.publications;
create policy "public read publications"
on public.publications for select
using (true);

drop policy if exists "public read publications stats view" on public.publications_with_stats;
-- Views do not support RLS policies directly; select permission is granted below.

-- Public event inserts for analytics.
drop policy if exists "public insert view events" on public.view_events;
create policy "public insert view events"
on public.view_events for insert
with check (true);

drop policy if exists "public insert download events" on public.download_events;
create policy "public insert download events"
on public.download_events for insert
with check (true);

-- Authenticated users can read their profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
using (auth.uid() = id);

-- Admins can read all profiles.
drop policy if exists "admin read profiles" on public.profiles;
create policy "admin read profiles"
on public.profiles for select
using (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

-- Editors and admins can insert publications.
drop policy if exists "editors insert publications" on public.publications;
create policy "editors insert publications"
on public.publications for insert
to authenticated
with check (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor')
));

-- Editors and admins can update publications.
drop policy if exists "editors update publications" on public.publications;
create policy "editors update publications"
on public.publications for update
to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor')
))
with check (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor')
));

grant usage on schema public to anon, authenticated;
grant select on public.publications to anon, authenticated;
grant select on public.publications_with_stats to anon, authenticated;
grant insert on public.view_events to anon, authenticated;
grant insert on public.download_events to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.publications to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- After you create staff accounts in Authentication > Users, elevate them here:
-- update public.profiles set role = 'admin' where id = 'USER_UUID_HERE';
-- update public.profiles set role = 'editor' where id = 'USER_UUID_HERE';
