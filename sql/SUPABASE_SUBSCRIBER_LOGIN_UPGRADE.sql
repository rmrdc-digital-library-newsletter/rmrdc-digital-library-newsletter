create table if not exists public.research_subscribers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  organisation text,
  phone text,
  research_areas text[] default '{}',
  email_notifications boolean not null default true,
  whatsapp_alerts boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.research_subscribers enable row level security;
drop policy if exists "public insert research subscribers" on public.research_subscribers;
create policy "public insert research subscribers" on public.research_subscribers for insert with check (true);
drop policy if exists "public update research subscribers" on public.research_subscribers;
create policy "public update research subscribers" on public.research_subscribers for update using (true) with check (true);
drop policy if exists "public read research subscribers for login" on public.research_subscribers;
create policy "public read research subscribers for login" on public.research_subscribers for select using (true);
