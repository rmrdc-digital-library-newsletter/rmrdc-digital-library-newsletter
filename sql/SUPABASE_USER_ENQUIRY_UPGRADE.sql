create table if not exists public.user_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  enquiry_type text not null,
  message text not null,
  source_page text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.user_enquiries enable row level security;

drop policy if exists "public insert user enquiries" on public.user_enquiries;
create policy "public insert user enquiries" on public.user_enquiries for insert with check (true);

drop policy if exists "admin read user enquiries" on public.user_enquiries;
create policy "admin read user enquiries" on public.user_enquiries for select using (true);

drop policy if exists "admin update user enquiries" on public.user_enquiries;
create policy "admin update user enquiries" on public.user_enquiries for update using (true) with check (true);
