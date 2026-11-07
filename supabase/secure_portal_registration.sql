-- Public signup must never accept staff roles from user-controlled metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  public_role text := case
    when requested_role in ('researcher','investor','fabricator','library_user') then requested_role
    else 'viewer'
  end;
begin
  insert into public.profiles (id, full_name, email, organisation, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'organisation',
    new.raw_user_meta_data->>'phone',
    public_role
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- The authenticated user's own profile may be edited, but its role cannot
-- be changed after registration. Legacy viewer accounts can choose a public
-- portal exactly once. Staff changes through the trusted admin service remain.
create or replace function public.enforce_portal_role_registration()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    if new.id is distinct from auth.uid() then
      raise exception 'A user can only manage their own profile';
    end if;
    if tg_op = 'INSERT' then
      if new.role not in ('viewer','researcher','investor','fabricator','library_user') then
        raise exception 'Staff roles cannot be self assigned';
      end if;
    elsif new.role is distinct from old.role then
      if old.role <> 'viewer' or new.role not in ('researcher','investor','fabricator','library_user') then
        raise exception 'Profile role changes require RMRDC administrator approval';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_portal_role_registration on public.profiles;
create trigger trg_enforce_portal_role_registration
before insert or update on public.profiles
for each row execute function public.enforce_portal_role_registration();

-- Registration stores selected and custom interests in separate protected tables.
-- These tables had RLS enabled but no policies, so authenticated inserts failed.
drop policy if exists "portal users read own interests" on public.user_interests;
drop policy if exists "portal users insert own interests" on public.user_interests;
drop policy if exists "portal users delete own interests" on public.user_interests;
drop policy if exists "portal users read own custom interests" on public.custom_interests;
drop policy if exists "portal users insert own custom interests" on public.custom_interests;
drop policy if exists "portal users delete own custom interests" on public.custom_interests;

do $$
declare
  interests_owner text := case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_interests' and column_name = 'user_id'
    ) then 'user_id'
    else 'profile_id'
  end;
  custom_owner text := case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'custom_interests' and column_name = 'user_id'
    ) then 'user_id'
    else 'profile_id'
  end;
begin
  execute format(
    'create policy "portal users read own interests" on public.user_interests
     for select to authenticated using (auth.uid() = %I)',
    interests_owner
  );
  execute format(
    'create policy "portal users insert own interests" on public.user_interests
     for insert to authenticated with check (auth.uid() = %I)',
    interests_owner
  );
  execute format(
    'create policy "portal users delete own interests" on public.user_interests
     for delete to authenticated using (auth.uid() = %I)',
    interests_owner
  );
  execute format(
    'create policy "portal users read own custom interests" on public.custom_interests
     for select to authenticated using (auth.uid() = %I)',
    custom_owner
  );
  execute format(
    'create policy "portal users insert own custom interests" on public.custom_interests
     for insert to authenticated with check (auth.uid() = %I)',
    custom_owner
  );
  execute format(
    'create policy "portal users delete own custom interests" on public.custom_interests
     for delete to authenticated using (auth.uid() = %I)',
    custom_owner
  );
end;
$$;
