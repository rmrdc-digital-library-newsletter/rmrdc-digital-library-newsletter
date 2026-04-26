-- RMRDC Email Notification Setup
-- Safe to run many times in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text,
  add column if not exists organisation text,
  add column if not exists research_areas text[] not null default '{}',
  add column if not exists email_notifications boolean not null default true;

alter table public.publications
  add column if not exists price numeric(12,2),
  add column if not exists is_paid boolean default false,
  add column if not exists research_areas text[] not null default '{}';

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
and p.email is null;

create table if not exists public.research_subscribers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  organisation text,
  research_areas text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publication_notifications (
  id bigserial primary key,
  publication_id uuid not null references public.publications(id) on delete cascade,
  subscriber_id uuid not null references public.research_subscribers(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(publication_id, subscriber_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_research_subscribers_updated_at on public.research_subscribers;
create trigger trg_research_subscribers_updated_at
  before update on public.research_subscribers
  for each row execute procedure public.set_updated_at();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  );
$$;

alter table public.research_subscribers enable row level security;
alter table public.publication_notifications enable row level security;

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles"
on public.profiles for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "admin read research subscribers" on public.research_subscribers;
create policy "admin read research subscribers"
on public.research_subscribers for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "admin insert research subscribers" on public.research_subscribers;
create policy "admin insert research subscribers"
on public.research_subscribers for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "admin update research subscribers" on public.research_subscribers;
create policy "admin update research subscribers"
on public.research_subscribers for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "admin read publication notifications" on public.publication_notifications;
create policy "admin read publication notifications"
on public.publication_notifications for select
to authenticated
using (public.current_user_is_admin());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.research_subscribers to authenticated;
grant select on public.publication_notifications to authenticated;
grant insert, update on public.publication_notifications to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create or replace function public.get_matching_research_subscribers(pub_id uuid)
returns table (
  subscriber_id uuid,
  full_name text,
  email text,
  organisation text,
  research_areas text[]
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.full_name, s.email, s.organisation, s.research_areas
  from public.research_subscribers s
  join public.publications p on p.id = pub_id
  where s.is_active = true
    and coalesce(array_length(s.research_areas, 1), 0) > 0
    and coalesce(array_length(p.research_areas, 1), 0) > 0
    and s.research_areas && p.research_areas;
$$;

create or replace function public.sync_research_subscriber_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and length(trim(new.email)) > 0 then
    insert into public.research_subscribers (
      full_name, email, organisation, research_areas, is_active
    ) values (
      coalesce(new.full_name, new.email),
      lower(new.email),
      new.organisation,
      coalesce(new.research_areas, '{}'),
      coalesce(new.email_notifications, true)
    )
    on conflict (email) do update set
      full_name = excluded.full_name,
      organisation = excluded.organisation,
      research_areas = excluded.research_areas,
      is_active = excluded.is_active,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_research_subscriber_from_profile on public.profiles;
create trigger trg_sync_research_subscriber_from_profile
  after insert or update of full_name, email, organisation, research_areas, email_notifications
  on public.profiles
  for each row execute procedure public.sync_research_subscriber_from_profile();
