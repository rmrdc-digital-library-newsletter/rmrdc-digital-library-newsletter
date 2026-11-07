-- RMRDC v3.4.7: Free demo EOI submission
-- Additive migration. Allows authenticated investors to send their own EOI to RMRDC.
-- No existing records are deleted or replaced.

alter table public.investor_requests enable row level security;

drop policy if exists investor_requests_investor_insert_v347 on public.investor_requests;
create policy investor_requests_investor_insert_v347
on public.investor_requests
for insert to authenticated
with check (investor_user_id = auth.uid());

drop policy if exists investor_requests_investor_read_v347 on public.investor_requests;
create policy investor_requests_investor_read_v347
on public.investor_requests
for select to authenticated
using (investor_user_id = auth.uid() or researcher_user_id = auth.uid() or public.is_platform_staff());
