-- RMRDC CAS AI Semantic Recommender Upgrade
-- Run in Supabase SQL Editor.

create extension if not exists vector;

create table if not exists public.publication_embeddings (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  content_text text not null,
  embedding vector(384),
  model text default 'sentence-transformers/all-MiniLM-L6-v2',
  created_at timestamptz not null default now(),
  unique(publication_id)
);

alter table public.publication_embeddings enable row level security;

drop policy if exists "public read publication embeddings" on public.publication_embeddings;
create policy "public read publication embeddings"
on public.publication_embeddings for select using (true);

drop policy if exists "service manage publication embeddings" on public.publication_embeddings;
create policy "service manage publication embeddings"
on public.publication_embeddings for all using (true) with check (true);

create index if not exists publication_embeddings_embedding_idx
on public.publication_embeddings
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function public.match_publications_by_embedding(
  query_embedding vector(384),
  match_count int default 8,
  exclude_publication_id uuid default null
)
returns table (
  publication_id uuid,
  similarity float
)
language sql stable
as $$
  select
    pe.publication_id,
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.publication_embeddings pe
  where exclude_publication_id is null or pe.publication_id <> exclude_publication_id
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;
