-- Central RMRDC account flow: run after SUPABASE_AUTH_ROLE_PROFILES_UPGRADE.sql.
-- Public portal roles may be selected at registration, then remain fixed.
-- The auth.users trigger stores the submitted role in platform_profiles; these
-- guards prevent authenticated clients from changing that role later.

create or replace function public.enforce_profile_role_registration()
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

drop trigger if exists trg_enforce_profile_role_registration on public.profiles;
create trigger trg_enforce_profile_role_registration
before insert or update on public.profiles
for each row execute function public.enforce_profile_role_registration();

create or replace function public.enforce_platform_profile_role_registration()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from auth.uid() then
      raise exception 'A user can only manage their own platform profile';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Portal role changes require RMRDC administrator approval';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_platform_profile_role_registration on public.platform_profiles;
create trigger trg_enforce_platform_profile_role_registration
before insert or update on public.platform_profiles
for each row execute function public.enforce_platform_profile_role_registration();

