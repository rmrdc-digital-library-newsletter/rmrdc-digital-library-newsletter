-- RMRDC v3.4.6: Investor EOI -> RMRDC approval -> Researcher -> Deal Room
-- Additive migration. Does not delete existing records.

alter table public.investor_requests add column if not exists investor_name text;
alter table public.investor_requests add column if not exists organisation text;
alter table public.investor_requests add column if not exists contact_email text;
alter table public.investor_requests add column if not exists phone text;
alter table public.investor_requests add column if not exists interest_type text;
alter table public.investor_requests add column if not exists investment_range text;
alter table public.investor_requests add column if not exists preferred_next_step text;
alter table public.investor_requests add column if not exists timeline text;
alter table public.investor_requests add column if not exists technology_title text;
alter table public.investor_requests add column if not exists researcher_user_id uuid references auth.users(id) on delete set null;
alter table public.investor_requests add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.investor_requests add column if not exists approved_at timestamptz;

create index if not exists investor_requests_researcher_status_idx on public.investor_requests(researcher_user_id,status,created_at desc);
create index if not exists investor_requests_technology_title_idx on public.investor_requests(technology_title);

-- Researcher-facing engagement view/table.
create table if not exists public.researcher_investor_interests (
  id uuid primary key default gen_random_uuid(),
  investor_request_id uuid unique not null references public.investor_requests(id) on delete cascade,
  researcher_user_id uuid not null references auth.users(id) on delete cascade,
  investor_user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid references public.technology_opportunities(id) on delete set null,
  technology_title text,
  interest_type text,
  message text,
  status text not null default 'approved' check (status in ('approved','viewed','engagement','deal','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists researcher_interests_user_idx on public.researcher_investor_interests(researcher_user_id,status,created_at desc);

-- Automatically route an approved request to the researcher who owns the opportunity when possible.
create or replace function public.rti_prepare_investor_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  if new.status='approved' and old.status is distinct from 'approved' then
    if new.researcher_user_id is null and new.opportunity_id is not null then
      select created_by into owner_id from public.technology_opportunities where id=new.opportunity_id;
      new.researcher_user_id := owner_id;
    end if;
    if new.approved_at is null then new.approved_at := now(); end if;
    if new.approved_by is null then new.approved_by := auth.uid(); end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_rti_prepare_investor_approval on public.investor_requests;
create trigger trg_rti_prepare_investor_approval before update on public.investor_requests for each row execute function public.rti_prepare_investor_approval();

create or replace function public.rti_publish_approved_interest()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='approved' and new.researcher_user_id is not null then
    insert into public.researcher_investor_interests(investor_request_id,researcher_user_id,investor_user_id,opportunity_id,technology_title,interest_type,message)
    values(new.id,new.researcher_user_id,new.investor_user_id,new.opportunity_id,new.technology_title,new.interest_type,new.message)
    on conflict (investor_request_id) do update set researcher_user_id=excluded.researcher_user_id, opportunity_id=excluded.opportunity_id, technology_title=excluded.technology_title, interest_type=excluded.interest_type, message=excluded.message, status='approved', updated_at=now();
    insert into public.platform_notifications(user_id,notification_type,title,message,link_url,entity_type,entity_id)
    values(new.researcher_user_id,'investor_interest_approved','New investor interest approved','RMRDC has approved an investor expression of interest in your technology. Review it in your Researcher Portal.','researcher-portal.html','investor_request',new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_rti_publish_approved_interest on public.investor_requests;
create trigger trg_rti_publish_approved_interest after update on public.investor_requests for each row execute function public.rti_publish_approved_interest();

-- Deal Room is only created after an approved investor request. The UI also enforces this rule.
-- Researchers can read their approved interest records.
alter table public.researcher_investor_interests enable row level security;
drop policy if exists researcher_interest_read on public.researcher_investor_interests;
create policy researcher_interest_read on public.researcher_investor_interests for select to authenticated using (researcher_user_id=auth.uid() or public.is_platform_staff());
drop policy if exists researcher_interest_staff on public.researcher_investor_interests;
create policy researcher_interest_staff on public.researcher_investor_interests for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

-- Investors can read their own request and staff can review; researchers only see assigned requests.
drop policy if exists investor_request_researcher_read_v346 on public.investor_requests;
create policy investor_request_researcher_read_v346 on public.investor_requests for select to authenticated using (investor_user_id=auth.uid() or researcher_user_id=auth.uid() or public.is_platform_staff());

-- Helpful notification index.
create index if not exists platform_notifications_entity_idx on public.platform_notifications(entity_type,entity_id);
