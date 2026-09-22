-- RMRDC Research-to-Industry Intelligence Platform v2.9 -> v3.0
-- Additive migration: preserves existing v2.9 tables and roles.
-- Run AFTER the existing v2.9 setup/upgrade scripts.

create extension if not exists pgcrypto;

-- ---------- Access / subscriptions ----------
create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'premium',
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_subscriptions_user_idx on public.platform_subscriptions(user_id,status);

create or replace function public.has_active_subscription(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.platform_subscriptions
    where user_id=p_user_id and status='active'
      and (ends_at is null or ends_at > now())
  );
$$;

-- ---------- Technology opportunities ----------
create table if not exists public.technology_opportunities (
  id uuid primary key default gen_random_uuid(),
  technology_id uuid references public.technologies(id) on delete set null,
  title text not null,
  short_summary text,
  sector text,
  category text,
  institution text,
  researcher_name text,
  trl int check (trl between 1 and 9),
  problem_addressed text,
  technical_specifications text,
  raw_materials text[] default '{}',
  raw_material_locations text[] default '{}',
  raw_material_availability text,
  production_process text,
  production_cost numeric,
  estimated_investment numeric,
  market_size numeric,
  market_summary text,
  commercialisation_status text,
  patent_ip_status text,
  prototype_status text,
  pilot_plant_availability text,
  demonstration_results text,
  existing_partnerships text,
  fabrication_requirements text,
  scale_up_requirements text,
  engagement_models text[] default '{}',
  regulatory_status text,
  supporting_documents jsonb default '[]'::jsonb,
  visibility text not null default 'draft' check (visibility in ('draft','under_review','approved','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tech_opportunities_status_idx on public.technology_opportunities(visibility);
create index if not exists tech_opportunities_sector_idx on public.technology_opportunities(sector);

-- Safe public summary view: sensitive commercial fields are not exposed.
create or replace view public.public_technology_opportunities as
select id,title,short_summary,sector,category,institution,researcher_name,trl,
       problem_addressed,raw_material_availability,prototype_status,
       pilot_plant_availability,commercialisation_status,patent_ip_status,
       visibility,published_at,created_at,updated_at
from public.technology_opportunities
where visibility='approved';

-- ---------- Investor profiles / requests ----------
create table if not exists public.investor_profiles_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  organisation text,
  sectors text[] default '{}',
  technology_interests text[] default '{}',
  preferred_trl_min int check (preferred_trl_min between 1 and 9),
  preferred_trl_max int check (preferred_trl_max between 1 and 9),
  investment_min numeric,
  investment_max numeric,
  geographic_interests text[] default '{}',
  commercialisation_interests text[] default '{}',
  engagement_models text[] default '{}',
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investor_requests (
  id uuid primary key default gen_random_uuid(),
  investor_user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid references public.technology_opportunities(id) on delete set null,
  request_type text not null check (request_type in ('information','full_brief','documents','engagement','expression_of_interest','researcher_meeting','fabrication')),
  message text,
  requested_items text[] default '{}',
  status text not null default 'received' check (status in ('received','under_review','information_requested','approved','submitted_to_investor','viewed','investor_interested','engagement','deal','rejected','closed')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technology_investor_submissions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.technology_opportunities(id) on delete cascade,
  investor_user_id uuid not null references auth.users(id) on delete cascade,
  submitted_by uuid references auth.users(id),
  note text,
  status text not null default 'submitted' check (status in ('submitted','viewed','interested','declined','engagement','deal')),
  submitted_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  unique(opportunity_id,investor_user_id)
);

-- ---------- Fabricator / engineering network ----------
create table if not exists public.fabricator_profiles_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  company_name text not null,
  specialisations text[] default '{}',
  equipment text[] default '{}',
  materials_handled text[] default '{}',
  manufacturing_capacity text,
  industries_served text[] default '{}',
  geographic_coverage text[] default '{}',
  certifications text[] default '{}',
  services_offered text[] default '{}',
  machinery text[] default '{}',
  description text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fabrication_requests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.technology_opportunities(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  fabricator_user_id uuid references auth.users(id) on delete set null,
  request_type text not null default 'fabrication',
  requirements text,
  status text not null default 'received' check (status in ('received','under_review','matched','accepted','declined','in_progress','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Dealroom ----------
create table if not exists public.dealrooms (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.technology_opportunities(id) on delete cascade,
  investor_user_id uuid references auth.users(id) on delete set null,
  researcher_user_id uuid references auth.users(id) on delete set null,
  rmrdc_representative uuid references auth.users(id) on delete set null,
  fabricator_user_id uuid references auth.users(id) on delete set null,
  investment_requirement numeric,
  trl int,
  commercialisation_stage text,
  stage text not null default 'opportunity_identified'
    check (stage in ('opportunity_identified','investor_matched','investor_interested','due_diligence','engagement','fabrication_scale_up','commercialisation','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealroom_activities (
  id uuid primary key default gen_random_uuid(),
  dealroom_id uuid not null references public.dealrooms(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Unified notifications ----------
create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  link_url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.platform_notifications(user_id,read_at,created_at desc);

-- ---------- Updated-at triggers ----------
do $$ declare t text; begin
  foreach t in array array['platform_subscriptions','technology_opportunities','investor_profiles_v2','investor_requests','fabricator_profiles_v2','fabrication_requests','dealrooms'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.platform_subscriptions enable row level security;
alter table public.technology_opportunities enable row level security;
alter table public.investor_profiles_v2 enable row level security;
alter table public.investor_requests enable row level security;
alter table public.technology_investor_submissions enable row level security;
alter table public.fabricator_profiles_v2 enable row level security;
alter table public.fabrication_requests enable row level security;
alter table public.dealrooms enable row level security;
alter table public.dealroom_activities enable row level security;
alter table public.platform_notifications enable row level security;

-- helper: current platform admin/editor
create or replace function public.is_platform_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','editor'));
$$;

-- Subscription owner can read own; staff can manage.
drop policy if exists subscriptions_self on public.platform_subscriptions;
create policy subscriptions_self on public.platform_subscriptions for select using (user_id=auth.uid() or public.is_platform_staff());
drop policy if exists subscriptions_staff_insert on public.platform_subscriptions;
create policy subscriptions_staff_insert on public.platform_subscriptions for insert to authenticated with check (public.is_platform_staff() or user_id=auth.uid());
drop policy if exists subscriptions_staff_update on public.platform_subscriptions;
create policy subscriptions_staff_update on public.platform_subscriptions for update to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

-- Technology opportunities: approved summaries are public; full records staff + owner.
drop policy if exists tech_public_read on public.technology_opportunities;
create policy tech_public_read on public.technology_opportunities for select using (
  visibility='approved' or public.is_platform_staff() or created_by=auth.uid()
);
drop policy if exists tech_owner_insert on public.technology_opportunities;
create policy tech_owner_insert on public.technology_opportunities for insert to authenticated with check (public.is_platform_staff() or created_by=auth.uid());
drop policy if exists tech_staff_update on public.technology_opportunities;
create policy tech_staff_update on public.technology_opportunities for update to authenticated using (public.is_platform_staff() or created_by=auth.uid()) with check (public.is_platform_staff() or created_by=auth.uid());

-- Investor profile: owner/staff.
drop policy if exists investor_profile_self on public.investor_profiles_v2;
create policy investor_profile_self on public.investor_profiles_v2 for all to authenticated using (user_id=auth.uid() or public.is_platform_staff()) with check (user_id=auth.uid() or public.is_platform_staff());

-- Investor requests: requester/staff.
drop policy if exists investor_requests_read on public.investor_requests;
create policy investor_requests_read on public.investor_requests for select to authenticated using (investor_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists investor_requests_insert on public.investor_requests;
create policy investor_requests_insert on public.investor_requests for insert to authenticated with check (investor_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists investor_requests_update on public.investor_requests;
create policy investor_requests_update on public.investor_requests for update to authenticated using (public.is_platform_staff() or investor_user_id=auth.uid()) with check (public.is_platform_staff() or investor_user_id=auth.uid());

-- Submissions: investor sees own; staff manages.
drop policy if exists submissions_read on public.technology_investor_submissions;
create policy submissions_read on public.technology_investor_submissions for select to authenticated using (investor_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists submissions_staff on public.technology_investor_submissions;
create policy submissions_staff on public.technology_investor_submissions for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

-- Fabricator profile: owner/staff, verified profiles can be discovered by authenticated users.
drop policy if exists fabricator_profile_read on public.fabricator_profiles_v2;
create policy fabricator_profile_read on public.fabricator_profiles_v2 for select to authenticated using (verified=true or user_id=auth.uid() or public.is_platform_staff());
drop policy if exists fabricator_profile_write on public.fabricator_profiles_v2;
create policy fabricator_profile_write on public.fabricator_profiles_v2 for all to authenticated using (user_id=auth.uid() or public.is_platform_staff()) with check (user_id=auth.uid() or public.is_platform_staff());

-- Fabrication requests: requester/fabricator/staff.
drop policy if exists fabrication_read on public.fabrication_requests;
create policy fabrication_read on public.fabrication_requests for select to authenticated using (requester_user_id=auth.uid() or fabricator_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists fabrication_insert on public.fabrication_requests;
create policy fabrication_insert on public.fabrication_requests for insert to authenticated with check (requester_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists fabrication_update on public.fabrication_requests;
create policy fabrication_update on public.fabrication_requests for update to authenticated using (fabricator_user_id=auth.uid() or requester_user_id=auth.uid() or public.is_platform_staff()) with check (fabricator_user_id=auth.uid() or requester_user_id=auth.uid() or public.is_platform_staff());

-- Dealrooms: participants/staff.
drop policy if exists dealroom_read on public.dealrooms;
create policy dealroom_read on public.dealrooms for select to authenticated using (
  investor_user_id=auth.uid() or researcher_user_id=auth.uid() or fabricator_user_id=auth.uid() or rmrdc_representative=auth.uid() or public.is_platform_staff()
);
drop policy if exists dealroom_write on public.dealrooms;
create policy dealroom_write on public.dealrooms for all to authenticated using (public.is_platform_staff() or investor_user_id=auth.uid() or researcher_user_id=auth.uid() or fabricator_user_id=auth.uid()) with check (public.is_platform_staff() or investor_user_id=auth.uid() or researcher_user_id=auth.uid() or fabricator_user_id=auth.uid());

drop policy if exists dealroom_activity_read on public.dealroom_activities;
create policy dealroom_activity_read on public.dealroom_activities for select to authenticated using (
  public.is_platform_staff() or exists (
    select 1 from public.dealrooms d where d.id=dealroom_id and (d.investor_user_id=auth.uid() or d.researcher_user_id=auth.uid() or d.fabricator_user_id=auth.uid() or d.rmrdc_representative=auth.uid())
  )
);
drop policy if exists dealroom_activity_insert on public.dealroom_activities;
create policy dealroom_activity_insert on public.dealroom_activities for insert to authenticated with check (actor_user_id=auth.uid() or public.is_platform_staff());

-- Notifications: recipient/staff.
drop policy if exists notifications_read on public.platform_notifications;
create policy notifications_read on public.platform_notifications for select to authenticated using (user_id=auth.uid() or public.is_platform_staff());
drop policy if exists notifications_update on public.platform_notifications;
create policy notifications_update on public.platform_notifications for update to authenticated using (user_id=auth.uid() or public.is_platform_staff()) with check (user_id=auth.uid() or public.is_platform_staff());
drop policy if exists notifications_staff_insert on public.platform_notifications;
create policy notifications_staff_insert on public.platform_notifications for insert to authenticated with check (public.is_platform_staff());

grant select on public.public_technology_opportunities to anon, authenticated;
grant execute on function public.has_active_subscription(uuid) to anon, authenticated;
grant execute on function public.is_platform_staff() to authenticated;
