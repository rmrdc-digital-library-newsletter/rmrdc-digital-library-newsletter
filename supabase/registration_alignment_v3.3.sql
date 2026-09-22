-- RMRDC Research-to-Industry Platform
-- Registration alignment for the existing v2.9 database.
-- IMPORTANT: This migration does NOT create duplicate profile tables.

-- 1. Prevent duplicate profile emails (case-insensitive).
create unique index if not exists profiles_email_lower_unique
on public.profiles (lower(email))
where email is not null and length(trim(email)) > 0;

-- 2. Allow authenticated users to create/update only their own role-specific profile.
alter table public.researcher_profiles enable row level security;
alter table public.investor_profiles enable row level security;
alter table public.library_user_profiles enable row level security;
alter table public.fabricator_profiles enable row level security;
alter table public.interest_categories enable row level security;

-- Researcher
 drop policy if exists "users insert own researcher profile" on public.researcher_profiles;
create policy "users insert own researcher profile" on public.researcher_profiles
for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "users update own researcher profile" on public.researcher_profiles;
create policy "users update own researcher profile" on public.researcher_profiles
for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "users read own researcher profile" on public.researcher_profiles;
create policy "users read own researcher profile" on public.researcher_profiles
for select to authenticated using (auth.uid() = profile_id);

-- Investor
 drop policy if exists "users insert own investor profile" on public.investor_profiles;
create policy "users insert own investor profile" on public.investor_profiles
for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "users update own investor profile" on public.investor_profiles;
create policy "users update own investor profile" on public.investor_profiles
for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "users read own investor profile" on public.investor_profiles;
create policy "users read own investor profile" on public.investor_profiles
for select to authenticated using (auth.uid() = profile_id);

-- Library user
 drop policy if exists "users insert own library profile" on public.library_user_profiles;
create policy "users insert own library profile" on public.library_user_profiles
for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "users update own library profile" on public.library_user_profiles;
create policy "users update own library profile" on public.library_user_profiles
for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "users read own library profile" on public.library_user_profiles;
create policy "users read own library profile" on public.library_user_profiles
for select to authenticated using (auth.uid() = profile_id);

-- Fabricator
 drop policy if exists "users insert own fabricator profile" on public.fabricator_profiles;
create policy "users insert own fabricator profile" on public.fabricator_profiles
for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "users update own fabricator profile" on public.fabricator_profiles;
create policy "users update own fabricator profile" on public.fabricator_profiles
for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "users read own fabricator profile" on public.fabricator_profiles;
create policy "users read own fabricator profile" on public.fabricator_profiles
for select to authenticated using (auth.uid() = profile_id);

-- Interest catalogue is safe to read publicly because it contains category names only.
drop policy if exists "public read active interest categories" on public.interest_categories;
create policy "public read active interest categories" on public.interest_categories
for select to anon, authenticated using (is_active = true);

-- 3. User interests are linked to profiles, not auth users.
-- Existing table already has the correct profile_id/interest_category_id structure.

-- 4. Keep role integrity explicit. This matches the current database roles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
check (role = any (array['admin','editor','viewer','researcher','investor','library_user','fabricator']));

-- 5. Optional: verify the current database before/after applying this migration.
-- select table_name from information_schema.tables where table_schema='public' order by table_name;
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.profiles'::regclass;
