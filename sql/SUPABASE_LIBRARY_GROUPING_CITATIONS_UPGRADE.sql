-- RMRDC Library grouping, ISBN, DOI, citations, ratings and comments upgrade
-- Run this in Supabase SQL Editor for an existing deployed database.

alter table public.publications add column if not exists isbn text;
alter table public.publications add column if not exists doi text;
alter table public.publications add column if not exists citation text;

create table if not exists public.publication_ratings (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reader_id text not null,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, reader_id)
);

create table if not exists public.publication_comments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reader_id text not null,
  reader_name text default 'Reader',
  comment_text text not null,
  created_at timestamptz not null default now()
);

alter table public.publication_ratings enable row level security;
alter table public.publication_comments enable row level security;

drop policy if exists "public read publication ratings" on public.publication_ratings;
create policy "public read publication ratings" on public.publication_ratings for select using (true);
drop policy if exists "public insert publication ratings" on public.publication_ratings;
create policy "public insert publication ratings" on public.publication_ratings for insert with check (true);
drop policy if exists "public update publication ratings" on public.publication_ratings;
create policy "public update publication ratings" on public.publication_ratings for update using (true) with check (true);

drop policy if exists "public read publication comments" on public.publication_comments;
create policy "public read publication comments" on public.publication_comments for select using (true);
drop policy if exists "public insert publication comments" on public.publication_comments;
create policy "public insert publication comments" on public.publication_comments for insert with check (true);

create or replace view public.publication_rating_summary as
select publication_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as rating_count
from public.publication_ratings
group by publication_id;

create or replace view public.publications_with_stats as
select
  p.*,
  coalesce(v.view_count, 0)::int as view_count,
  coalesce(d.download_count, 0)::int as download_count,
  coalesce(r.avg_rating, 0)::numeric as avg_rating,
  coalesce(r.rating_count, 0)::int as rating_count
from public.publications p
left join (
  select publication_id, count(*) as view_count
  from public.view_events
  group by publication_id
) v on v.publication_id = p.id
left join (
  select publication_id, count(*) as download_count
  from public.download_events
  group by publication_id
) d on d.publication_id = p.id
left join public.publication_rating_summary r on r.publication_id = p.id;
