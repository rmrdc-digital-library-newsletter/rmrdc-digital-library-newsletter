-- RLS for the live researcher schema that uses researcher_profiles.profile_id.
-- Run after the researcher tables exist.

alter table public.profiles enable row level security;
drop policy if exists "researcher read own profile" on public.profiles;
create policy "researcher read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());
grant select on public.profiles to authenticated;

alter table public.researcher_profiles enable row level security;
drop policy if exists researcher_profile_self_profile_id on public.researcher_profiles;
create policy researcher_profile_self_profile_id
on public.researcher_profiles for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
grant select, insert, update on public.researcher_profiles to authenticated;

-- technology_opportunities is optional until the Research-to-Industry migration
-- has been run. Apply its policies after that table exists.
