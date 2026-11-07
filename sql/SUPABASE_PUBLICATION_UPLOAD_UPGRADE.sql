-- Publication upload fields and Storage permissions for existing Supabase projects.
-- Run after supabase/setup.sql. Safe to run more than once.

alter table public.publications
  add column if not exists isbn text,
  add column if not exists doi text,
  add column if not exists citation text,
  add column if not exists price numeric(12,2) not null default 0,
  add column if not exists is_paid boolean not null default false,
  add column if not exists storage_type text not null default 'public',
  add column if not exists publication_format text not null default 'pdf',
  add column if not exists preview_page_limit integer,
  add column if not exists pdf_path text,
  add column if not exists preview_url text,
  add column if not exists ebook_url text,
  add column if not exists ebook_entry text,
  add column if not exists ebook_path text,
  add column if not exists research_areas text[] not null default '{}',
  add column if not exists research_significance text,
  add column if not exists key_findings text,
  add column if not exists methodology text,
  add column if not exists data_resources text,
  add column if not exists research_gaps text,
  add column if not exists research_implications text,
  add column if not exists context_geography text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists limitations text,
  add column if not exists recommended_for text;

alter table public.publications alter column pdf_url drop not null;
alter table public.publications alter column preview_page_limit drop not null;

alter table public.publications
  drop constraint if exists publications_publication_format_check;

alter table public.publications
  add constraint publications_publication_format_check
  check (publication_format in ('pdf', 'html'));

insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('documents', 'documents', true),
  ('paid-documents', 'paid-documents', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read publication upload assets" on storage.objects;
create policy "public read publication upload assets"
  on storage.objects for select to public
  using (bucket_id in ('covers', 'documents'));

drop policy if exists "staff manage publication upload assets" on storage.objects;
create policy "staff manage publication upload assets"
  on storage.objects for all to authenticated
  using (
    bucket_id in ('covers', 'documents', 'paid-documents')
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'editor')
    )
  )
  with check (
    bucket_id in ('covers', 'documents', 'paid-documents')
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

drop view if exists public.publications_with_stats;
do $$
begin
  if to_regclass('public.publication_rating_summary') is not null then
    execute $view$
      create view public.publications_with_stats as
      select
        p.*,
        coalesce(v.view_count, 0)::int as view_count,
        coalesce(d.download_count, 0)::int as download_count,
        coalesce(r.avg_rating, 0)::numeric as avg_rating,
        coalesce(r.rating_count, 0)::int as rating_count
      from public.publications p
      left join (
        select publication_id, count(*) as view_count
        from public.view_events group by publication_id
      ) v on v.publication_id = p.id
      left join (
        select publication_id, count(*) as download_count
        from public.download_events group by publication_id
      ) d on d.publication_id = p.id
      left join public.publication_rating_summary r on r.publication_id = p.id
    $view$;
  else
    execute $view$
      create view public.publications_with_stats as
      select
        p.*,
        coalesce(v.view_count, 0)::int as view_count,
        coalesce(d.download_count, 0)::int as download_count
      from public.publications p
      left join (
        select publication_id, count(*) as view_count
        from public.view_events group by publication_id
      ) v on v.publication_id = p.id
      left join (
        select publication_id, count(*) as download_count
        from public.download_events group by publication_id
      ) d on d.publication_id = p.id
    $view$;
  end if;
end $$;

grant select on public.publications_with_stats to anon, authenticated;

notify pgrst, 'reload schema';