-- RMRDC CAS HTML eBook / CD-ROM Upload Support
-- Run this in Supabase SQL Editor.

alter table public.publications
add column if not exists publication_format text not null default 'pdf',
add column if not exists ebook_url text,
add column if not exists ebook_entry text,
add column if not exists ebook_path text;

-- Allow PDF or HTML publication format.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'publications_publication_format_check'
  ) then
    alter table public.publications
    add constraint publications_publication_format_check
    check (publication_format in ('pdf', 'html'));
  end if;
end $$;

-- Make pdf_url nullable for HTML eBooks if your older table forced it NOT NULL.
alter table public.publications alter column pdf_url drop not null;

-- If you use publications_with_stats view, recreate it so new columns are visible.
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

-- Storage note:
-- Use your existing public documents bucket for HTML eBooks.
-- Ensure bucket "documents" is public or has public read policy for HTML assets.
