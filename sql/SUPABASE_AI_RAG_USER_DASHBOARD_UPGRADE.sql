create table if not exists public.saved_publications (id uuid primary key default gen_random_uuid(), reader_id text not null, publication_id uuid not null references public.publications(id) on delete cascade, saved_at timestamptz not null default now(), unique(reader_id, publication_id));
create table if not exists public.reading_history (id uuid primary key default gen_random_uuid(), reader_id text not null, publication_id uuid not null references public.publications(id) on delete cascade, viewed_at timestamptz not null default now());
create table if not exists public.publication_ai_summaries (id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.publications(id) on delete cascade, summary text not null, model text, created_at timestamptz not null default now(), unique(publication_id));
create table if not exists public.publication_chunks (id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.publications(id) on delete cascade, page_number int, chunk_index int, content text not null, created_at timestamptz not null default now());
alter table public.saved_publications enable row level security; alter table public.reading_history enable row level security; alter table public.publication_ai_summaries enable row level security; alter table public.publication_chunks enable row level security;
-- Keep account-specific activity private and permit only the owning user to manage it.
drop policy if exists "public saved publications access" on public.saved_publications;
drop policy if exists saved_publications_owner_select on public.saved_publications;
drop policy if exists saved_publications_owner_insert on public.saved_publications;
drop policy if exists saved_publications_owner_delete on public.saved_publications;
drop policy if exists saved_publications_owner_update on public.saved_publications;
create policy saved_publications_owner_select on public.saved_publications for select to authenticated using (reader_id=auth.uid()::text);
create policy saved_publications_owner_insert on public.saved_publications for insert to authenticated with check (reader_id=auth.uid()::text);
create policy saved_publications_owner_delete on public.saved_publications for delete to authenticated using (reader_id=auth.uid()::text);
create policy saved_publications_owner_update on public.saved_publications for update to authenticated using (reader_id=auth.uid()::text) with check (reader_id=auth.uid()::text);

drop policy if exists "public reading history access" on public.reading_history;
drop policy if exists reading_history_owner_select on public.reading_history;
drop policy if exists reading_history_owner_insert on public.reading_history;
drop policy if exists reading_history_owner_delete on public.reading_history;
drop policy if exists reading_history_owner_update on public.reading_history;
create policy reading_history_owner_select on public.reading_history for select to authenticated using (reader_id=auth.uid()::text);
create policy reading_history_owner_insert on public.reading_history for insert to authenticated with check (reader_id=auth.uid()::text);
create policy reading_history_owner_delete on public.reading_history for delete to authenticated using (reader_id=auth.uid()::text);
create policy reading_history_owner_update on public.reading_history for update to authenticated using (reader_id=auth.uid()::text) with check (reader_id=auth.uid()::text);

-- Keep one most recent view per reader/publication so repeated opens update recency.
with ranked_history as (
  select id, row_number() over (partition by reader_id, publication_id order by viewed_at desc, id desc) as row_num
  from public.reading_history
)
delete from public.reading_history h using ranked_history r where h.id=r.id and r.row_num>1;
create unique index if not exists reading_history_reader_publication_uidx on public.reading_history(reader_id,publication_id);
revoke all on public.saved_publications, public.reading_history from anon;
grant select, insert, update, delete on public.saved_publications, public.reading_history to authenticated;
drop policy if exists "public read ai summaries" on public.publication_ai_summaries; create policy "public read ai summaries" on public.publication_ai_summaries for select using (true);
drop policy if exists "service insert ai summaries" on public.publication_ai_summaries; create policy "service insert ai summaries" on public.publication_ai_summaries for insert with check (true);
drop policy if exists "public read publication chunks" on public.publication_chunks; create policy "public read publication chunks" on public.publication_chunks for select using (true);
drop policy if exists "service insert publication chunks" on public.publication_chunks; create policy "service insert publication chunks" on public.publication_chunks for insert with check (true);