-- Enable live dashboard metrics for inserts that affect activity figures.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['publications', 'profiles', 'research_subscribers', 'view_events', 'download_events', 'technology_opportunities', 'researcher_investor_interests'] loop
      if to_regclass(format('public.%I', table_name)) is not null and not exists (
        select 1
        from pg_publication_rel pr
        join pg_class c on c.oid = pr.prrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_publication p on p.oid = pr.prpubid
        where p.pubname = 'supabase_realtime'
          and n.nspname = 'public'
          and c.relname = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;