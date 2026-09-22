-- RMRDC CAS Bulletin Support
create table if not exists public.cas_bulletins (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  bulletin_type text default 'CAS Bulletin',
  sectors text[] default '{}',
  summary text,
  body text not null,
  publications jsonb default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cas_bulletins enable row level security;

drop policy if exists "public read published cas bulletins" on public.cas_bulletins;
create policy "public read published cas bulletins"
on public.cas_bulletins for select using (status = 'published');

drop policy if exists "admin manage cas bulletins" on public.cas_bulletins;
create policy "admin manage cas bulletins"
on public.cas_bulletins for all using (true) with check (true);

create table if not exists public.cas_bulletin_deliveries (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid references public.cas_bulletins(id) on delete cascade,
  subscriber_email text,
  subscriber_phone text,
  channel text,
  status text default 'pending',
  error text,
  created_at timestamptz default now()
);

alter table public.cas_bulletin_deliveries enable row level security;

drop policy if exists "admin read cas bulletin deliveries" on public.cas_bulletin_deliveries;
create policy "admin read cas bulletin deliveries"
on public.cas_bulletin_deliveries for select using (true);

drop policy if exists "service insert cas bulletin deliveries" on public.cas_bulletin_deliveries;
create policy "service insert cas bulletin deliveries"
on public.cas_bulletin_deliveries for insert with check (true);
