-- RMRDC Research-to-Industry authentication + role/profile foundation
-- Run AFTER setup.sql and the existing Research-to-Industry migrations.
-- This migration does NOT permit self-assignment of admin/editor roles.

create table if not exists public.researcher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  institution text,
  position text,
  research_areas text,
  orcid text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_category text,
  alert_frequency text,
  subject_areas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- investor_profiles_v2 and fabricator_profiles_v2 are created by the v3 migration.
alter table public.researcher_profiles enable row level security;
alter table public.library_user_profiles enable row level security;

drop policy if exists researcher_profile_self on public.researcher_profiles;
create policy researcher_profile_self on public.researcher_profiles for all to authenticated
using (user_id=auth.uid() or public.is_platform_staff())
with check (user_id=auth.uid() or public.is_platform_staff());

drop policy if exists library_profile_self on public.library_user_profiles;
create policy library_profile_self on public.library_user_profiles for all to authenticated
using (user_id=auth.uid() or public.is_platform_staff())
with check (user_id=auth.uid() or public.is_platform_staff());

-- Ensure updated_at exists for these role profiles.
drop trigger if exists trg_researcher_profiles_updated_at on public.researcher_profiles;
create trigger trg_researcher_profiles_updated_at before update on public.researcher_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_library_user_profiles_updated_at on public.library_user_profiles;
create trigger trg_library_user_profiles_updated_at before update on public.library_user_profiles
for each row execute procedure public.set_updated_at();

grant select, insert, update, delete on public.researcher_profiles, public.library_user_profiles to authenticated;

-- The legacy profiles.role remains restricted to admin/editor/viewer.
-- Platform roles live in platform_profiles and cannot become admin through sign-up metadata.
create or replace function public.handle_new_platform_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_full_name text;
  v_org text;
  v_phone text;
  v_location text;
  v_interests jsonb;
  v_role_data jsonb;
begin
  v_role := case
    when new.raw_user_meta_data->>'role' in ('researcher','investor','fabricator','library_user')
      then new.raw_user_meta_data->>'role'
    else 'library_user'
  end;

  v_full_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), new.email);
  v_org := nullif(new.raw_user_meta_data->>'organisation','');
  v_phone := nullif(new.raw_user_meta_data->>'phone','');
  v_location := nullif(new.raw_user_meta_data->>'location','');
  v_interests := coalesce(new.raw_user_meta_data->'interests','[]'::jsonb);
  v_role_data := coalesce(new.raw_user_meta_data->'role_data','{}'::jsonb);

  insert into public.platform_profiles
    (user_id, role, full_name, organisation, phone, location, profile_data, interest_data)
  values
    (new.id, v_role, v_full_name, v_org, v_phone, v_location, v_role_data, v_interests)
  on conflict (user_id) do update set
    role=excluded.role, full_name=excluded.full_name, organisation=excluded.organisation,
    phone=excluded.phone, location=excluded.location, profile_data=excluded.profile_data,
    interest_data=excluded.interest_data, updated_at=now();

  insert into public.user_interests(user_id, interest)
  select new.id, value
  from jsonb_array_elements_text(v_interests) as x(value)
  where nullif(trim(value),'') is not null
  on conflict (user_id, interest) do nothing;

  if v_role='researcher' then
    insert into public.researcher_profiles(user_id,institution,position,research_areas,orcid,bio)
    values (new.id,v_role_data->>'institution',v_role_data->>'position',v_role_data->>'researchAreas',v_role_data->>'orcid',v_role_data->>'bio')
    on conflict (user_id) do update set
      institution=excluded.institution, position=excluded.position, research_areas=excluded.research_areas,
      orcid=excluded.orcid, bio=excluded.bio, updated_at=now();

  elsif v_role='investor' then
    insert into public.investor_profiles_v2
      (user_id,organisation,technology_interests,preferred_trl_min,preferred_trl_max,commercialisation_interests,engagement_models,profile_complete)
    values (
      new.id,v_org,ARRAY(SELECT jsonb_array_elements_text(v_interests)),
      case v_role_data->>'preferredTrl'
        when 'TRL 1–3' then 1 when 'TRL 4–5' then 4 when 'TRL 6–7' then 6 when 'TRL 8–9' then 8 else null end,
      case v_role_data->>'preferredTrl'
        when 'TRL 1–3' then 3 when 'TRL 4–5' then 5 when 'TRL 6–7' then 7 when 'TRL 8–9' then 9 else null end,
      case when nullif(v_role_data->>'investmentStage','') is null then '{}' else array[v_role_data->>'investmentStage'] end,
      case when nullif(v_role_data->>'engagementModels','') is null then '{}' else string_to_array(v_role_data->>'engagementModels',',') end,
      true
    )
    on conflict (user_id) do update set
      organisation=excluded.organisation, technology_interests=excluded.technology_interests,
      preferred_trl_min=excluded.preferred_trl_min, preferred_trl_max=excluded.preferred_trl_max,
      commercialisation_interests=excluded.commercialisation_interests, engagement_models=excluded.engagement_models,
      profile_complete=true, updated_at=now();

  elsif v_role='fabricator' then
    insert into public.fabricator_profiles_v2
      (user_id,company_name,specialisations,equipment,manufacturing_capacity,geographic_coverage,certifications,services_offered)
    values (
      new.id,coalesce(v_org,v_full_name),
      case when nullif(v_role_data->>'fabricationSpecialisation','') is null then '{}' else string_to_array(v_role_data->>'fabricationSpecialisation',',') end,
      case when nullif(v_role_data->>'equipmentCategories','') is null then '{}' else string_to_array(v_role_data->>'equipmentCategories',',') end,
      v_role_data->>'capacity',
      case when nullif(v_role_data->>'coverage','') is null then '{}' else string_to_array(v_role_data->>'coverage',',') end,
      case when nullif(v_role_data->>'certifications','') is null then '{}' else string_to_array(v_role_data->>'certifications',',') end,
      case when nullif(v_role_data->>'servicesOffered','') is null then '{}' else string_to_array(v_role_data->>'servicesOffered',',') end
    )
    on conflict (user_id) do update set
      company_name=excluded.company_name, specialisations=excluded.specialisations,
      equipment=excluded.equipment, manufacturing_capacity=excluded.manufacturing_capacity,
      geographic_coverage=excluded.geographic_coverage, certifications=excluded.certifications,
      services_offered=excluded.services_offered, updated_at=now();

  else
    insert into public.library_user_profiles(user_id,user_category,alert_frequency,subject_areas)
    values (new.id,v_role_data->>'userCategory',v_role_data->>'alertFrequency',v_role_data->>'subjectAreas')
    on conflict (user_id) do update set
      user_category=excluded.user_category, alert_frequency=excluded.alert_frequency,
      subject_areas=excluded.subject_areas, updated_at=now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_platform_profile on auth.users;
create trigger on_auth_user_created_platform_profile
after insert on auth.users
for each row execute procedure public.handle_new_platform_user();

-- Existing accounts: create platform profiles only when a platform profile is missing.
-- Admin/editor legacy roles are never overwritten by this migration.
insert into public.platform_profiles(user_id,role,full_name)
select p.id,'library_user',coalesce(p.full_name,u.email)
from public.profiles p
join auth.users u on u.id=p.id
left join public.platform_profiles pp on pp.user_id=p.id
where pp.user_id is null and p.role='viewer'
on conflict (user_id) do nothing;
