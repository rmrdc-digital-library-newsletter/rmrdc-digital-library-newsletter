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

-- ============================================================
-- V2.9 Research-to-Industry Intelligence profile and matching layer
-- ============================================================
create table if not exists public.platform_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('researcher','investor','library_user','fabricator')),
  full_name text not null,
  organisation text,
  phone text,
  location text,
  profile_data jsonb not null default '{}'::jsonb,
  interest_data jsonb not null default '[]'::jsonb,
  email_alerts boolean not null default true,
  whatsapp_alerts boolean not null default false,
  verification_status text not null default 'Submitted' check (verification_status in ('Draft','Submitted','Under Review','Verified','Restricted','Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interest_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  parent_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interest text not null,
  created_at timestamptz not null default now(),
  unique(user_id, interest)
);

create table if not exists public.custom_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interest text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matching_configuration (
  key text primary key,
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  description text,
  updated_at timestamptz not null default now()
);

insert into public.matching_configuration(key,weight,description) values
('sector_match',25,'Alignment between user sector and opportunity sector'),
('technology_interest',20,'Alignment with technology interests'),
('raw_material_interest',15,'Alignment with raw-material interests'),
('trl_compatibility',15,'Compatibility with preferred technology readiness level'),
('geographic_fit',10,'Geographic alignment'),
('commercial_interest',10,'Commercialisation/investment-stage alignment'),
('engagement_preference',5,'Alignment of preferred engagement model')
on conflict(key) do nothing;

alter table public.platform_profiles enable row level security;
alter table public.interest_categories enable row level security;
alter table public.user_interests enable row level security;
alter table public.custom_interests enable row level security;
alter table public.matching_configuration enable row level security;

drop policy if exists "read own platform profile" on public.platform_profiles;
create policy "read own platform profile" on public.platform_profiles for select to authenticated using (auth.uid()=user_id);
drop policy if exists "insert own platform profile" on public.platform_profiles;
create policy "insert own platform profile" on public.platform_profiles for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "update own platform profile" on public.platform_profiles;
create policy "update own platform profile" on public.platform_profiles for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "read interests" on public.user_interests;
create policy "read interests" on public.user_interests for select to authenticated using (auth.uid()=user_id);
drop policy if exists "manage own interests" on public.user_interests;
create policy "manage own interests" on public.user_interests for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "read custom interests" on public.custom_interests;
create policy "read custom interests" on public.custom_interests for select to authenticated using (auth.uid()=user_id);
drop policy if exists "manage own custom interests" on public.custom_interests;
create policy "manage own custom interests" on public.custom_interests for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "public read interest categories" on public.interest_categories;
create policy "public read interest categories" on public.interest_categories for select using (active=true);

drop policy if exists "authenticated read matching configuration" on public.matching_configuration;
create policy "authenticated read matching configuration" on public.matching_configuration for select to authenticated using (true);

insert into public.interest_categories(name,parent_name) values
('Agriculture & Agro-processing',null),('Cassava','Agriculture & Agro-processing'),('Rice','Agriculture & Agro-processing'),('Maize','Agriculture & Agro-processing'),('Shea','Agriculture & Agro-processing'),('Sesame','Agriculture & Agro-processing'),('Soybean','Agriculture & Agro-processing'),('Groundnut','Agriculture & Agro-processing'),('Palm Products','Agriculture & Agro-processing'),('Chemicals & Petrochemicals',null),('Pharmaceuticals',null),('Food & Beverage',null),('Construction Materials',null),('Mining & Minerals',null),('Metals',null),('Ceramics',null),('Polymers & Plastics',null),('Renewable Energy',null),('Bioenergy',null),('Biotechnology',null),('Environmental Technologies',null),('Water Technologies',null),('Manufacturing Technologies',null),('Industrial Equipment',null),('Digital Technologies',null),('Textiles & Leather',null),('Packaging',null),('Waste-to-Value',null)
on conflict(name) do nothing;

create index if not exists idx_user_interests_user on public.user_interests(user_id);
create index if not exists idx_platform_profiles_role on public.platform_profiles(role);
create index if not exists idx_platform_profiles_status on public.platform_profiles(verification_status);

create table if not exists public.technologies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  sector text,
  applications text[] default '{}',
  trl int check (trl between 1 and 9),
  ip_status text,
  production_cost numeric,
  raw_material_cost numeric,
  operating_cost numeric,
  capex numeric,
  production_capacity text,
  yield text,
  market_size numeric,
  expected_demand text,
  import_substitution text,
  locations text[] default '{}',
  raw_materials text[] default '{}',
  technology_interests text[] default '{}',
  commercialisation_stage text,
  engagement_models text[] default '{}',
  access_tier text not null default 'Registered User',
  verification_status text not null default 'Submitted' check (verification_status in ('Draft','Submitted','Under Review','Verified','Published','Restricted','Archived')),
  researcher_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  classification text,
  locations text[] default '{}',
  availability text,
  quantity text,
  seasonality text,
  suppliers_count int,
  market_price text,
  logistics text,
  storage text,
  applications text[] default '{}',
  verification_status text not null default 'Submitted',
  created_at timestamptz not null default now()
);

create table if not exists public.technology_matches (
  id uuid primary key default gen_random_uuid(),
  technology_id uuid not null references public.technologies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric(5,2) not null,
  reasons text[] default '{}',
  created_at timestamptz not null default now(),
  unique(technology_id,user_id)
);

create table if not exists public.cas_intelligence_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  alert_type text not null,
  sector text,
  related_technology_id uuid references public.technologies(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.technologies enable row level security;
alter table public.raw_materials enable row level security;
alter table public.technology_matches enable row level security;
alter table public.cas_intelligence_alerts enable row level security;

drop policy if exists "public read published technologies" on public.technologies;
create policy "public read published technologies" on public.technologies for select using (verification_status in ('Verified','Published'));
drop policy if exists "authenticated read own technology matches" on public.technology_matches;
create policy "authenticated read own technology matches" on public.technology_matches for select to authenticated using (auth.uid()=user_id);
drop policy if exists "public read verified raw materials" on public.raw_materials;
create policy "public read verified raw materials" on public.raw_materials for select using (verification_status in ('Verified','Published'));
drop policy if exists "authenticated read cas intelligence" on public.cas_intelligence_alerts;
create policy "authenticated read cas intelligence" on public.cas_intelligence_alerts for select to authenticated using (true);

grant select on public.technologies, public.raw_materials, public.cas_intelligence_alerts to anon, authenticated;
grant select on public.technology_matches to authenticated;
create index if not exists idx_technologies_sector on public.technologies(sector);
create index if not exists idx_technologies_trl on public.technologies(trl);
create index if not exists idx_technology_matches_user on public.technology_matches(user_id);
create index if not exists idx_cas_alerts_sector on public.cas_intelligence_alerts(sector);
