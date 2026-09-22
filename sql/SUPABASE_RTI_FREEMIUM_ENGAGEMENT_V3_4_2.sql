-- RMRDC Research-to-Industry v3.4.2
-- Freemium technology intelligence + managed researcher/investor/fabricator workflow.
-- Run in Supabase SQL Editor before production use.

-- 1. Subscription helper. Authorization data stays in the database, not in client code.
create or replace function public.has_active_platform_subscription(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.platform_subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

-- 2. Safe discovery view. It intentionally exposes only free/public discovery fields.
drop view if exists public.public_technology_opportunities;
create view public.public_technology_opportunities
with (security_invoker=false) as
select
  id,title,sector,trl,visibility,short_summary,problem_addressed,
  raw_material_availability,patent_ip_status,created_at,published_at
from public.technology_opportunities
where visibility='approved';

grant select on public.public_technology_opportunities to anon, authenticated;

-- 3. Full opportunity records: staff/owners or active subscribers.
drop policy if exists tech_public_read on public.technology_opportunities;
create policy tech_public_read on public.technology_opportunities
for select to authenticated
using (
  public.is_platform_staff()
  or created_by=auth.uid()
  or (visibility='approved' and public.has_active_platform_subscription(auth.uid()))
);

-- 4. RMRDC staff can receive and manage investor requests and fabrication requests.
-- Existing RLS policies remain in force; these indexes improve the admin workflow.
create index if not exists investor_requests_status_created_idx
on public.investor_requests(status, created_at desc);
create index if not exists fabrication_requests_status_created_idx
on public.fabrication_requests(status, created_at desc);
create index if not exists dealrooms_stage_updated_idx
on public.dealrooms(stage, updated_at desc);

-- 5. Notifications for RMRDC-managed engagement workflows.
create index if not exists platform_notifications_user_created_idx
on public.platform_notifications(user_id, created_at desc);

-- 6. Researchers can see investor requests attached to technologies they own,
-- while investors continue to see only their own requests.
drop policy if exists researcher_related_investor_requests_read on public.investor_requests;
create policy researcher_related_investor_requests_read
on public.investor_requests for select to authenticated
using (
  exists (
    select 1 from public.technology_opportunities t
    where t.id=investor_requests.opportunity_id
      and t.created_by=auth.uid()
  )
  or public.is_platform_staff()
  or investor_user_id=auth.uid()
);

-- 7. Researchers can see fabrication requests linked to technologies they own.
drop policy if exists researcher_related_fabrication_requests_read on public.fabrication_requests;
create policy researcher_related_fabrication_requests_read
on public.fabrication_requests for select to authenticated
using (
  requester_user_id=auth.uid()
  or fabricator_user_id=auth.uid()
  or public.is_platform_staff()
  or exists (
    select 1 from public.technology_opportunities t
    where t.id=fabrication_requests.opportunity_id
      and t.created_by=auth.uid()
  )
);

-- 8. Explicit investor submission policy required by the Express Interest form.
drop policy if exists investor_requests_investor_insert on public.investor_requests;
create policy investor_requests_investor_insert
on public.investor_requests for insert to authenticated
with check (investor_user_id = auth.uid() or public.is_platform_staff());
