-- Publication RAG foundations for the existing RMRDC-CAS schema.
-- Run after SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql.
-- Uses the existing all-MiniLM-L6-v2 384-dimensional embedding path.

create extension if not exists vector;

alter table public.publications
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

create table if not exists public.publication_chunks (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  page_number integer,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.publication_chunks
  add column if not exists source_name text,
  add column if not exists section text,
  add column if not exists token_count integer;

create table if not exists public.publication_indexing_status (
  publication_id uuid primary key references public.publications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'indexed', 'failed')),
  indexed_chunks integer not null default 0,
  source_hash text,
  last_error text,
  started_at timestamptz,
  indexed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Keep vectors in a child table rather than changing the existing nullable
-- publication_chunks.embedding column whose deployed type is not established.
create table if not exists public.publication_chunk_embeddings (
  chunk_id uuid primary key references public.publication_chunks(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  embedding vector(384) not null,
  model text not null default 'sentence-transformers/all-MiniLM-L6-v2',
  created_at timestamptz not null default now()
);

create table if not exists public.publication_embeddings (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null unique references public.publications(id) on delete cascade,
  content_text text not null,
  embedding vector(384),
  model text not null default 'sentence-transformers/all-MiniLM-L6-v2',
  created_at timestamptz not null default now()
);

create index if not exists publication_chunk_embeddings_vector_idx
  on public.publication_chunk_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);
create index if not exists publication_embeddings_embedding_idx
  on public.publication_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);
create index if not exists publication_chunks_publication_page_idx
  on public.publication_chunks(publication_id, page_number, chunk_index);
create index if not exists publications_research_fields_search_idx
  on public.publications using gin (to_tsvector('simple', concat_ws(' ',
    title, authors, type, year::text, isbn, doi, abstract,
    array_to_string(research_areas, ' '), research_significance, key_findings,
    methodology, data_resources, research_gaps, research_implications,
    context_geography, array_to_string(keywords, ' '), limitations, recommended_for
  )));

alter table public.publication_indexing_status enable row level security;
alter table public.publication_chunk_embeddings enable row level security;
alter table public.publication_chunks enable row level security;

drop policy if exists "public read publication chunks" on public.publication_chunks;
create policy "public read publication chunks"
  on public.publication_chunks for select to public
  using (exists (
    select 1 from public.publications p
    where p.id = publication_chunks.publication_id
      and (
        (coalesce(p.is_paid, false) = false and coalesce(p.price, 0) <= 0)
        or coalesce(publication_chunks.page_number, 1) <= coalesce(p.preview_page_limit, 4)
      )
  ));

drop policy if exists "staff read publication chunks" on public.publication_chunks;
create policy "staff read publication chunks"
  on public.publication_chunks for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

drop policy if exists "service insert publication chunks" on public.publication_chunks;
drop policy if exists "staff manage publication chunks" on public.publication_chunks;
create policy "staff manage publication chunks"
  on public.publication_chunks for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

 drop policy if exists "staff read publication indexing status" on public.publication_indexing_status;
create policy "staff read publication indexing status"
  on public.publication_indexing_status for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

drop policy if exists "staff manage publication indexing status" on public.publication_indexing_status;
create policy "staff manage publication indexing status"
  on public.publication_indexing_status for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

drop policy if exists "staff read publication chunk embeddings" on public.publication_chunk_embeddings;
create policy "staff read publication chunk embeddings"
  on public.publication_chunk_embeddings for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

drop policy if exists "staff manage publication chunk embeddings" on public.publication_chunk_embeddings;
create policy "staff manage publication chunk embeddings"
  on public.publication_chunk_embeddings for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

-- Existing vectors are only used by the server-side recommender. Stop exposing
-- those raw vectors directly through the public REST API.
drop policy if exists "public read publication embeddings" on public.publication_embeddings;
drop policy if exists "service manage publication embeddings" on public.publication_embeddings;
drop policy if exists "staff manage publication embeddings" on public.publication_embeddings;
create policy "staff read publication embeddings"
  on public.publication_embeddings for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));
create policy "staff manage publication embeddings"
  on public.publication_embeddings for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  ));

create or replace function public.set_publication_index_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.publication_indexing_status(publication_id, status, indexed_chunks, last_error, updated_at)
  values (new.id, 'pending', 0, null, now())
  on conflict (publication_id) do update
    set status = 'pending', indexed_chunks = 0, last_error = null, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_publications_index_pending_insert on public.publications;
create trigger trg_publications_index_pending_insert
  after insert on public.publications
  for each row execute procedure public.set_publication_index_pending();

drop trigger if exists trg_publications_index_pending_update on public.publications;
create trigger trg_publications_index_pending_update
  after update of title, authors, type, year, abstract, isbn, doi, research_areas,
    research_significance, key_findings, methodology, data_resources, research_gaps,
    research_implications, context_geography, keywords, limitations, recommended_for,
    pdf_url, pdf_path, ebook_url, ebook_path
  on public.publications
  for each row when (old.updated_at is distinct from new.updated_at)
  execute procedure public.set_publication_index_pending();

insert into public.publication_indexing_status(publication_id, status)
select id, 'pending' from public.publications
on conflict (publication_id) do nothing;

create or replace function public.promote_publication_index(
  p_publication_id uuid,
  p_chunks jsonb,
  p_profile_content text,
  p_profile_embedding vector(384),
  p_model text,
  p_source_hash text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item record;
  new_chunk_id uuid;
  inserted_count integer := 0;
begin
  if not exists (select 1 from public.publications where id = p_publication_id) then
    raise exception 'Publication % does not exist', p_publication_id;
  end if;

  delete from public.publication_chunks where publication_id = p_publication_id;

  for item in
    select * from jsonb_to_recordset(coalesce(p_chunks, '[]'::jsonb)) as x(
      page_number integer,
      chunk_index integer,
      content text,
      source_name text,
      section text,
      token_count integer,
      embedding text
    )
  loop
    insert into public.publication_chunks(
      publication_id, page_number, chunk_index, content, source_name, section, token_count
    ) values (
      p_publication_id, item.page_number, item.chunk_index, item.content,
      item.source_name, item.section, item.token_count
    ) returning id into new_chunk_id;

    insert into public.publication_chunk_embeddings(chunk_id, publication_id, embedding, model)
    values (new_chunk_id, p_publication_id, item.embedding::vector(384), p_model);
    inserted_count := inserted_count + 1;
  end loop;

  insert into public.publication_embeddings(publication_id, content_text, embedding, model)
  values (p_publication_id, p_profile_content, p_profile_embedding, p_model)
  on conflict (publication_id) do update
    set content_text = excluded.content_text,
        embedding = excluded.embedding,
        model = excluded.model,
        created_at = now();

  update public.publication_indexing_status
  set status = 'indexed', indexed_chunks = inserted_count, source_hash = p_source_hash,
      last_error = null, indexed_at = now(), updated_at = now()
  where publication_id = p_publication_id;

  return inserted_count;
end;
$$;

revoke execute on function public.promote_publication_index(uuid, jsonb, text, vector, text, text)
  from public, anon, authenticated;
grant execute on function public.promote_publication_index(uuid, jsonb, text, vector, text, text)
  to service_role;

-- The publications view is recreated so the new canonical Research Intelligence
-- columns are visible through the existing library/viewer query path.
drop view if exists public.publications_with_stats;
do $$
begin
  if to_regclass('public.publication_rating_summary') is not null then
    execute $view$
      create view public.publications_with_stats as
      select p.*, coalesce(v.view_count, 0)::int as view_count,
             coalesce(d.download_count, 0)::int as download_count,
             coalesce(r.avg_rating, 0)::numeric as avg_rating,
             coalesce(r.rating_count, 0)::int as rating_count
      from public.publications p
      left join (select publication_id, count(*) as view_count from public.view_events group by publication_id) v on v.publication_id = p.id
      left join (select publication_id, count(*) as download_count from public.download_events group by publication_id) d on d.publication_id = p.id
      left join public.publication_rating_summary r on r.publication_id = p.id
    $view$;
  else
    execute $view$
      create view public.publications_with_stats as
      select p.*, coalesce(v.view_count, 0)::int as view_count,
             coalesce(d.download_count, 0)::int as download_count
      from public.publications p
      left join (select publication_id, count(*) as view_count from public.view_events group by publication_id) v on v.publication_id = p.id
      left join (select publication_id, count(*) as download_count from public.download_events group by publication_id) d on d.publication_id = p.id
    $view$;
  end if;
end $$;

grant select on public.publications_with_stats to anon, authenticated;
grant select on public.publication_indexing_status to authenticated;
grant select on public.publication_chunk_embeddings to authenticated;

-- Return only public publication evidence; raw embedding vectors never leave SQL.
create or replace function public.search_publication_evidence(
  p_query text,
  p_query_embedding vector(384),
  p_match_count integer default 24
)
returns table (
  publication_id uuid,
  title text,
  authors text,
  type text,
  year integer,
  viewer_url text,
  page_number integer,
  evidence_type text,
  content text,
  relevance real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with query_data as (
    select
      nullif(trim(p_query), '') as query_text,
      websearch_to_tsquery('simple', coalesce(nullif(trim(p_query), ''), '')) as query_terms
  ),
  semantic_chunk_candidates as (
    select ce.chunk_id,
           greatest(0::real, (1 - (ce.embedding <=> p_query_embedding))::real) as similarity
    from public.publication_chunk_embeddings ce
    join public.publications p on p.id = ce.publication_id
    where p_query_embedding is not null
      and (
        (coalesce(p.is_paid, false) = false and coalesce(p.price, 0) <= 0)
        or exists (
          select 1 from public.publication_chunks preview_chunk
          where preview_chunk.id = ce.chunk_id
            and coalesce(preview_chunk.page_number, 1) <= coalesce(p.preview_page_limit, 4)
        )
      )
    order by ce.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 24) * 8, 240))
  ),
  semantic_profile_candidates as (
    select pe.publication_id,
           greatest(0::real, (1 - (pe.embedding <=> p_query_embedding))::real) as similarity
    from public.publication_embeddings pe
    where p_query_embedding is not null and pe.embedding is not null
    order by pe.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 24) * 4, 120))
  ),
  full_text_evidence as (
    select
      p.id as publication_id,
      p.title,
      p.authors,
      p.type,
      p.year,
      'viewer.html?id=' || p.id::text || '#page/' || coalesce(c.page_number, 1)::text as viewer_url,
      c.page_number,
      'publication_text'::text as evidence_type,
      c.content,
      (
        coalesce(sc.similarity, 0::real) * 0.65
        + ts_rank_cd(to_tsvector('simple', c.content), q.query_terms) * 0.25
        + case when c.content ilike '%' || q.query_text || '%' then 0.10 else 0 end
        + case
            when q.query_text ~* '(gap|unanswered|future research)' and p.research_gaps is not null then 0.12
            when q.query_text ~* '(finding|result|evidence)' and p.key_findings is not null then 0.12
            when q.query_text ~* '(method|approach)' and p.methodology is not null then 0.12
            when q.query_text ~* '(important|significance|matter|relevant)' and p.research_significance is not null then 0.12
            when q.query_text ~* '(data|dataset|resource|protocol|instrument)' and p.data_resources is not null then 0.12
            else 0
          end
      )::real as relevance
    from public.publication_chunks c
    join public.publications p on p.id = c.publication_id
    left join semantic_chunk_candidates sc on sc.chunk_id = c.id
    cross join query_data q
    where q.query_text is not null
      and (
        (coalesce(p.is_paid, false) = false and coalesce(p.price, 0) <= 0)
        or coalesce(c.page_number, 1) <= coalesce(p.preview_page_limit, 4)
      )
      and (
        to_tsvector('simple', c.content) @@ q.query_terms
        or c.content ilike '%' || q.query_text || '%'
        or sc.chunk_id is not null
      )
  ),
  profile_evidence as (
    select
      p.id as publication_id,
      p.title,
      p.authors,
      p.type,
      p.year,
      'viewer.html?id=' || p.id::text as viewer_url,
      null::integer as page_number,
      'research_profile'::text as evidence_type,
      pe.content_text as content,
      (
        coalesce(sc.similarity, 0::real) * 0.65
        + ts_rank_cd(to_tsvector('simple', pe.content_text), q.query_terms) * 0.25
        + case when pe.content_text ilike '%' || q.query_text || '%' then 0.10 else 0 end
        + case
            when q.query_text ~* '(gap|unanswered|future research)' and p.research_gaps is not null then 0.12
            when q.query_text ~* '(finding|result|evidence)' and p.key_findings is not null then 0.12
            when q.query_text ~* '(method|approach)' and p.methodology is not null then 0.12
            when q.query_text ~* '(important|significance|matter|relevant)' and p.research_significance is not null then 0.12
            when q.query_text ~* '(data|dataset|resource|protocol|instrument)' and p.data_resources is not null then 0.12
            else 0
          end
      )::real as relevance
    from public.publication_embeddings pe
    join public.publications p on p.id = pe.publication_id
    left join semantic_profile_candidates sc on sc.publication_id = pe.publication_id
    cross join query_data q
    where q.query_text is not null
      and (
        to_tsvector('simple', pe.content_text) @@ q.query_terms
        or pe.content_text ilike '%' || q.query_text || '%'
        or sc.publication_id is not null
      )
  )
  select candidates.publication_id, candidates.title, candidates.authors,
         candidates.type, candidates.year, candidates.viewer_url, candidates.page_number,
         candidates.evidence_type, candidates.content, candidates.relevance
  from (
    select * from full_text_evidence
    union all
    select * from profile_evidence
  ) candidates
  order by candidates.relevance desc, candidates.year desc nulls last
  limit greatest(1, least(coalesce(p_match_count, 24), 60));
$$;

grant execute on function public.search_publication_evidence(text, vector, integer) to anon, authenticated;
