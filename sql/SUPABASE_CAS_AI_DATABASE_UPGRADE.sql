-- RMRDC CAS Subscription + AI Librarian database support
-- Run this in Supabase SQL Editor.

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
create policy "public insert research subscribers"
on public.research_subscribers for insert with check (true);

drop policy if exists "public update research subscribers" on public.research_subscribers;
create policy "public update research subscribers"
on public.research_subscribers for update using (true) with check (true);

drop policy if exists "admin read research subscribers" on public.research_subscribers;
create policy "admin read research subscribers"
on public.research_subscribers for select using (true);

create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  category text check (category in ('mineral', 'agro')),
  name text not null,
  description text,
  uses text[] default '{}',
  locations text[] default '{}',
  relevance text,
  cover_image text,
  pilot_plant_name text,
  pilot_plant_image text,
  value_chain jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.raw_materials enable row level security;

drop policy if exists "public read raw materials" on public.raw_materials;
create policy "public read raw materials"
on public.raw_materials for select using (true);
