-- RMRDC PaddleOCR-VL document intelligence layer.
-- Additive migration. Run after the existing Research-to-Industry migrations.

create extension if not exists pgcrypto;

alter table public.technology_opportunities add column if not exists abstract text;
alter table public.technology_opportunities add column if not exists executive_summary text;

drop view if exists public.public_technology_opportunities;
create view public.public_technology_opportunities
with (security_invoker=false) as
select id,title,abstract,executive_summary,short_summary,sector,category,institution,researcher_name,trl,
       problem_addressed,raw_material_availability,prototype_status,
       pilot_plant_availability,commercialisation_status,patent_ip_status,
       visibility,published_at,created_at,updated_at
from public.technology_opportunities
where visibility='approved';
grant select on public.public_technology_opportunities to anon, authenticated;

do $$ begin
  create type public.document_processing_status as enum ('queued','processing','completed','failed','empty','missing');
exception when duplicate_object then null; end $$;
alter type public.document_processing_status add value if not exists 'missing';

do $$ begin
  create type public.document_access_tier as enum ('demo','subscriber','staff');
exception when duplicate_object then null; end $$;

create table if not exists public.technology_documents (
  id uuid primary key default gen_random_uuid(),
  technology_id uuid not null references public.technology_opportunities(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  filename text not null,
  source_hash text,
  source_version text,
  access_tier public.document_access_tier not null default 'subscriber',
  status public.document_processing_status not null default 'queued',
  page_count integer,
  last_processed_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storage_bucket, storage_path, source_hash)
);
alter table public.technology_documents alter column source_hash drop not null;

do $$
declare null_count integer;
begin
  select count(*) into null_count from public.technology_documents where technology_id is null;
  if null_count > 0 then
    raise exception 'Cannot enforce technology_id NOT NULL: % existing technology_documents rows have NULL technology_id. Reconcile them explicitly, then rerun this migration.', null_count;
  end if;
end $$;
alter table public.technology_documents alter column technology_id set not null;

do $$
declare duplicate_count integer;
begin
  select count(*) into duplicate_count from (select storage_bucket,storage_path from public.technology_documents group by storage_bucket,storage_path having count(*) > 1) duplicates;
  if duplicate_count > 0 then
    raise exception 'Cannot enforce unique Storage registration: % duplicate storage_bucket/storage_path groups exist. Reconcile them explicitly, then rerun this migration.', duplicate_count;
  end if;
end $$;
create unique index if not exists technology_documents_storage_identity_idx on public.technology_documents(storage_bucket,storage_path);

create table if not exists public.technology_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.technology_documents(id) on delete cascade,
  technology_id uuid references public.technology_opportunities(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  section text,
  content text not null,
  structured_content jsonb not null default '{}'::jsonb,
  access_tier public.document_access_tier not null default 'subscriber',
  source_filename text not null,
  created_at timestamptz not null default now(),
  unique(document_id, page_number, chunk_index)
);

create table if not exists public.technology_document_insights (
  id uuid primary key default gen_random_uuid(),
  technology_id uuid not null references public.technology_opportunities(id) on delete cascade,
  document_id uuid not null references public.technology_documents(id) on delete cascade,
  schema_version text not null default 'rti-technology-v1',
  fields jsonb not null default '{}'::jsonb,
  abstract text,
  executive_summary text,
  citations jsonb not null default '[]'::jsonb,
  access_tier public.document_access_tier not null default 'subscriber',
  model text,
  generated_at timestamptz not null default now(),
  unique(technology_id, document_id)
);

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.technology_documents(id) on delete cascade,
  status public.document_processing_status not null default 'queued',
  attempts integer not null default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists technology_documents_technology_idx on public.technology_documents(technology_id,status);
create index if not exists technology_document_chunks_technology_idx on public.technology_document_chunks(technology_id,page_number);
create index if not exists technology_document_chunks_search_idx on public.technology_document_chunks using gin(to_tsvector('simple', content));
create index if not exists document_jobs_status_idx on public.document_processing_jobs(status,created_at);
create unique index if not exists document_processing_one_active_idx
on public.document_processing_jobs(document_id)
where status in ('queued','processing');

create or replace function public.promote_document_processing(
  p_document_id uuid,
  p_job_id uuid,
  p_technology_id uuid,
  p_access_tier public.document_access_tier,
  p_filename text,
  p_chunks jsonb,
  p_fields jsonb,
  p_abstract text,
  p_executive_summary text,
  p_citations jsonb,
  p_model text
)
returns void
language plpgsql security definer set search_path=public as $$
begin
  delete from public.technology_document_chunks where document_id=p_document_id;
  insert into public.technology_document_chunks(document_id,technology_id,page_number,chunk_index,section,content,structured_content,access_tier,source_filename)
  select p_document_id,p_technology_id,x.page_number,x.chunk_index,x.section,x.content,x.structured_content,p_access_tier,p_filename
  from jsonb_to_recordset(coalesce(p_chunks,'[]'::jsonb)) as x(page_number integer,chunk_index integer,section text,content text,structured_content jsonb);
  insert into public.technology_document_insights(technology_id,document_id,fields,abstract,executive_summary,citations,access_tier,model,generated_at)
  values(p_technology_id,p_document_id,coalesce(p_fields,'{}'::jsonb),p_abstract,p_executive_summary,coalesce(p_citations,'[]'::jsonb),p_access_tier,p_model,now())
  on conflict(technology_id,document_id) do update set fields=excluded.fields,abstract=excluded.abstract,executive_summary=excluded.executive_summary,citations=excluded.citations,access_tier=excluded.access_tier,model=excluded.model,generated_at=excluded.generated_at;
  update public.technology_documents set status='completed',last_processed_at=now(),last_error=null,updated_at=now() where id=p_document_id;
  update public.document_processing_jobs set status='completed',completed_at=now(),error=null where id=p_job_id;
end $$;

revoke execute on function public.promote_document_processing(uuid,uuid,uuid,public.document_access_tier,text,jsonb,jsonb,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.promote_document_processing(uuid,uuid,uuid,public.document_access_tier,text,jsonb,jsonb,text,text,jsonb,text) to service_role;

alter table public.technology_documents enable row level security;
alter table public.technology_document_chunks enable row level security;
alter table public.technology_document_insights enable row level security;
alter table public.document_processing_jobs enable row level security;

drop policy if exists technology_documents_read on public.technology_documents;
create policy technology_documents_read on public.technology_documents for select to authenticated using (
  public.is_platform_staff() or access_tier='demo' or public.has_active_platform_subscription(auth.uid())
);
drop policy if exists technology_documents_staff_write on public.technology_documents;
create policy technology_documents_staff_write on public.technology_documents for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());
drop policy if exists technology_document_chunks_read on public.technology_document_chunks;
create policy technology_document_chunks_read on public.technology_document_chunks for select to authenticated using (
  public.is_platform_staff() or access_tier='demo' or public.has_active_platform_subscription(auth.uid())
);
drop policy if exists technology_document_chunks_staff_write on public.technology_document_chunks;
create policy technology_document_chunks_staff_write on public.technology_document_chunks for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());
drop policy if exists technology_document_insights_read on public.technology_document_insights;
create policy technology_document_insights_read on public.technology_document_insights for select to authenticated using (
  public.is_platform_staff() or access_tier='demo' or public.has_active_platform_subscription(auth.uid())
);
drop policy if exists technology_document_insights_staff_write on public.technology_document_insights;
create policy technology_document_insights_staff_write on public.technology_document_insights for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());
drop policy if exists document_processing_jobs_staff on public.document_processing_jobs;
create policy document_processing_jobs_staff on public.document_processing_jobs for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

-- The Edge Function calls this RPC before constructing Gemini context. It is
-- deliberately auth.uid()-based so service-role retrieval cannot bypass it.
create or replace function public.retrieve_technology_document_context(
  p_technology_id uuid,
  p_query text default '',
  p_limit integer default 12
)
returns table(
  document_id uuid,
  technology_id uuid,
  page_number integer,
  section text,
  content text,
  source_filename text,
  access_tier public.document_access_tier
)
language sql stable security invoker set search_path=public as $$
  select c.document_id,c.technology_id,c.page_number,c.section,c.content,c.source_filename,c.access_tier
  from public.technology_document_chunks c
  join public.technology_documents d on d.id=c.document_id
  where c.technology_id=p_technology_id
    and d.status='completed'
    and (c.access_tier='demo' or public.is_platform_staff() or public.has_active_platform_subscription(auth.uid()))
    and (nullif(trim(p_query),'') is null or c.content ilike '%' || trim(p_query) || '%')
  order by c.page_number,c.chunk_index
  limit greatest(1,least(p_limit,50));
$$;
