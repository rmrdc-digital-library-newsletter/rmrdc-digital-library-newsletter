-- RMRDC Email Notification Setup
-- Safe to run many times in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text,
  add column if not exists organisation text,
  add column if not exists research_areas text[] not null default '{}',
  add column if not exists email_notifications boolean not null default true;

-- Public signups become subscribers as soon as their account is created,
-- including when email confirmation is required before the first sign-in.
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
  interests text[] := array(
    select jsonb_array_elements_text(
      case when jsonb_typeof(new.raw_user_meta_data->'interests') = 'array'
        then new.raw_user_meta_data->'interests' else '[]'::jsonb end
    )
  );
begin
  insert into public.profiles (
    id, full_name, role, email, organisation, research_areas, email_notifications
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    public_role,
    new.email,
    new.raw_user_meta_data->>'organisation',
    coalesce(interests, '{}'::text[]),
    coalesce(new.raw_user_meta_data->>'email_alerts', 'true') <> 'false'
  )
  on conflict (id) do update set
    email = excluded.email,
    organisation = excluded.organisation,
    research_areas = excluded.research_areas,
    email_notifications = excluded.email_notifications;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  organisation text,
  research_areas text[] not null default '{}',
  is_active boolean not null default true,
  email_notifications boolean not null default true,
  admin_email_enabled boolean not null default true,
  whatsapp_alerts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bring existing deployments up to the same subscriber schema.
alter table public.research_subscribers
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists phone text,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists email_notifications boolean not null default true,
  add column if not exists admin_email_enabled boolean not null default true,
  add column if not exists whatsapp_alerts boolean not null default false;

create unique index if not exists research_subscribers_unsubscribe_token_uidx
  on public.research_subscribers(unsubscribe_token);

update public.research_subscribers s
set profile_id = p.id
from public.profiles p
where s.profile_id is null and lower(s.email) = lower(p.email);

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

create table if not exists public.cas_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  subject text not null,
  body_text text not null,
  audience_mode text not null check (audience_mode in ('all', 'areas', 'selected')),
  audience_areas text[] not null default '{}',
  scheduled_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  bounced_count integer not null default 0,
  complained_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.cas_email_campaign_recipients (
  id bigserial primary key,
  campaign_id uuid not null references public.cas_email_campaigns(id) on delete cascade,
  subscriber_id uuid not null references public.research_subscribers(id) on delete cascade,
  email text not null,
  unsubscribe_token uuid not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  email_delivery_status text not null default 'pending',
  delivered_at timestamptz,
  opened_at timestamptz,
  open_count integer not null default 0,
  clicked_at timestamptz,
  click_count integer not null default 0,
  bounced_at timestamptz,
  complained_at timestamptz,
  last_email_event_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

alter table public.cas_email_campaigns
  add column if not exists skipped_count integer not null default 0,
  add column if not exists delivered_count integer not null default 0,
  add column if not exists opened_count integer not null default 0,
  add column if not exists clicked_count integer not null default 0,
  add column if not exists bounced_count integer not null default 0,
  add column if not exists complained_count integer not null default 0;
alter table public.cas_email_campaign_recipients
  add column if not exists claimed_at timestamptz,
  add column if not exists email_delivery_status text not null default 'pending',
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists clicked_at timestamptz,
  add column if not exists click_count integer not null default 0,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists last_email_event_at timestamptz;
alter table public.cas_email_campaign_recipients
  drop constraint if exists cas_email_campaign_recipients_status_check;
alter table public.cas_email_campaign_recipients
  add constraint cas_email_campaign_recipients_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

create index if not exists cas_email_campaigns_due_idx
  on public.cas_email_campaigns(status, scheduled_at);
create index if not exists cas_email_campaign_recipients_due_idx
  on public.cas_email_campaign_recipients(campaign_id, status, next_attempt_at);

create table if not exists public.cas_email_webhook_events (
  id bigserial primary key,
  svix_id text not null unique,
  email_id text not null,
  event_type text not null,
  recipient_email text,
  event_created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  recipient_id bigint references public.cas_email_campaign_recipients(id) on delete set null,
  received_at timestamptz not null default now()
);

create index if not exists cas_email_webhook_events_unmatched_idx
  on public.cas_email_webhook_events(email_id, id) where recipient_id is null;
alter table public.cas_email_webhook_events enable row level security;
revoke all on public.cas_email_webhook_events from anon, authenticated;
grant all on public.cas_email_webhook_events to service_role;

create or replace function public.apply_cas_email_webhook_event(p_event_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.cas_email_webhook_events%rowtype;
  rec public.cas_email_campaign_recipients%rowtype;
  event_time timestamptz;
begin
  select * into ev from public.cas_email_webhook_events where id = p_event_id for update;
  if not found then return jsonb_build_object('matched', false, 'reason', 'event_missing'); end if;
  if ev.recipient_id is not null then return jsonb_build_object('matched', true, 'duplicate', true); end if;

  select * into rec from public.cas_email_campaign_recipients
  where provider_message_id = ev.email_id limit 1 for update;
  if not found then return jsonb_build_object('matched', false); end if;

  event_time := coalesce(ev.event_created_at, now());
  update public.cas_email_campaign_recipients set
    email_delivery_status = case
      when ev.event_type = 'email.complained' then 'complained'
      when ev.event_type = 'email.bounced' then 'bounced'
      when ev.event_type = 'email.failed' then case when email_delivery_status = 'delivered' then email_delivery_status else 'failed' end
      when ev.event_type = 'email.suppressed' then case when email_delivery_status in ('delivered','bounced','complained') then email_delivery_status else 'suppressed' end
      when ev.event_type = 'email.delivered' then case when email_delivery_status in ('bounced','complained') then email_delivery_status else 'delivered' end
      when ev.event_type = 'email.delivery_delayed' then case when email_delivery_status in ('pending','sent','delayed') then 'delayed' else email_delivery_status end
      when ev.event_type = 'email.sent' then case when email_delivery_status = 'pending' then 'sent' else email_delivery_status end
      else email_delivery_status
    end,
    delivered_at = case when ev.event_type = 'email.delivered' then coalesce(delivered_at, event_time) else delivered_at end,
    opened_at = case when ev.event_type = 'email.opened' then coalesce(opened_at, event_time) else opened_at end,
    open_count = open_count + case when ev.event_type = 'email.opened' then 1 else 0 end,
    clicked_at = case when ev.event_type = 'email.clicked' then coalesce(clicked_at, event_time) else clicked_at end,
    click_count = click_count + case when ev.event_type = 'email.clicked' then 1 else 0 end,
    bounced_at = case when ev.event_type = 'email.bounced' then coalesce(bounced_at, event_time) else bounced_at end,
    complained_at = case when ev.event_type = 'email.complained' then coalesce(complained_at, event_time) else complained_at end,
    last_email_event_at = greatest(coalesce(last_email_event_at, event_time), event_time)
  where id = rec.id;

  update public.cas_email_campaigns set
    delivered_count = delivered_count + case when ev.event_type = 'email.delivered' and rec.delivered_at is null then 1 else 0 end,
    opened_count = opened_count + case when ev.event_type = 'email.opened' and rec.opened_at is null then 1 else 0 end,
    clicked_count = clicked_count + case when ev.event_type = 'email.clicked' and rec.clicked_at is null then 1 else 0 end,
    bounced_count = bounced_count + case when ev.event_type = 'email.bounced' and rec.bounced_at is null then 1 else 0 end,
    complained_count = complained_count + case when ev.event_type = 'email.complained' and rec.complained_at is null then 1 else 0 end
  where id = rec.campaign_id;

  update public.cas_email_webhook_events set recipient_id = rec.id where id = ev.id;

  if ev.event_type = 'email.complained' then
    update public.research_subscribers s set email_notifications = false, updated_at = now()
    where s.id = rec.subscriber_id;
    update public.profiles p set email_notifications = false
    from public.research_subscribers s
    where s.id = rec.subscriber_id and s.profile_id = p.id;
  end if;

  return jsonb_build_object('matched', true, 'recipient_id', rec.id);
end;
$$;

create or replace function public.record_cas_email_webhook_event(
  p_svix_id text, p_email_id text, p_event_type text, p_recipient_email text,
  p_event_created_at timestamptz, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id bigint;
  existing_id bigint;
  result jsonb;
begin
  insert into public.cas_email_webhook_events(svix_id, email_id, event_type, recipient_email, event_created_at, payload)
  values (p_svix_id, p_email_id, p_event_type, p_recipient_email, coalesce(p_event_created_at, now()), coalesce(p_payload, '{}'::jsonb))
  on conflict (svix_id) do nothing returning id into inserted_id;
  if inserted_id is null then
    select id into existing_id from public.cas_email_webhook_events where svix_id = p_svix_id;
    return jsonb_build_object('duplicate', true, 'event_id', existing_id);
  end if;
  result := public.apply_cas_email_webhook_event(inserted_id);
  return result || jsonb_build_object('duplicate', false, 'event_id', inserted_id);
end;
$$;

create or replace function public.reconcile_cas_email_webhook_events(p_email_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare ev_id bigint; matched_count integer := 0; result jsonb;
begin
  for ev_id in select id from public.cas_email_webhook_events where email_id = p_email_id and recipient_id is null order by id loop
    result := public.apply_cas_email_webhook_event(ev_id);
    if coalesce((result->>'matched')::boolean, false) then matched_count := matched_count + 1; end if;
  end loop;
  return matched_count;
end;
$$;

revoke all on function public.apply_cas_email_webhook_event(bigint) from public, anon, authenticated;
revoke all on function public.record_cas_email_webhook_event(text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_cas_email_webhook_events(text) from public, anon, authenticated;
grant execute on function public.record_cas_email_webhook_event(text, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.reconcile_cas_email_webhook_events(text) to service_role;

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
    and p.role in ('admin', 'editor')
  );
$$;

alter table public.research_subscribers enable row level security;
alter table public.publication_notifications enable row level security;
alter table public.cas_email_campaigns enable row level security;
alter table public.cas_email_campaign_recipients enable row level security;

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

drop policy if exists "admin read cas email campaigns" on public.cas_email_campaigns;
create policy "admin read cas email campaigns"
on public.cas_email_campaigns for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "admin read cas email campaign recipients" on public.cas_email_campaign_recipients;
create policy "admin read cas email campaign recipients"
on public.cas_email_campaign_recipients for select
to authenticated
using (public.current_user_is_admin());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.research_subscribers to authenticated;
grant select on public.publication_notifications to authenticated;
grant insert, update on public.publication_notifications to service_role;
grant select on public.cas_email_campaigns, public.cas_email_campaign_recipients to authenticated;
grant all on public.cas_email_campaigns, public.cas_email_campaign_recipients to service_role;
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
      profile_id, full_name, email, organisation, research_areas, is_active,
      email_notifications, admin_email_enabled, whatsapp_alerts
    ) values (
      new.id,
      coalesce(new.full_name, new.email),
      lower(new.email),
      new.organisation,
      coalesce(new.research_areas, '{}'),
      true,
      coalesce(new.email_notifications, true),
      true,
      false
    )
    on conflict (email) do update set
      full_name = excluded.full_name,
      organisation = excluded.organisation,
      research_areas = excluded.research_areas,
      profile_id = excluded.profile_id,
      email_notifications = excluded.email_notifications,
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
