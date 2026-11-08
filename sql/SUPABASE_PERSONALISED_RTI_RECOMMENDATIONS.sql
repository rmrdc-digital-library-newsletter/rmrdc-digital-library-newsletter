-- Personalized RMRDC technology recommendation foundation.
-- Public opportunities remain discoverable only after approval; engagement still
-- requires the existing RMRDC approval workflow.

create table if not exists public.technology_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.technology_opportunities(id) on delete cascade,
  role text not null,
  match_score numeric not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  recommendation_source text not null default 'profile',
  created_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

alter table public.technology_recommendations enable row level security;
drop policy if exists technology_recommendations_owner_read on public.technology_recommendations;
create policy technology_recommendations_owner_read
on public.technology_recommendations for select to authenticated
using (user_id = auth.uid() or public.is_platform_staff());

create index if not exists technology_recommendations_user_score_idx
on public.technology_recommendations(user_id, match_score desc, created_at desc);
