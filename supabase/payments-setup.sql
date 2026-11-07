-- Paystack payment records for paid publication access.
-- Run this in the Supabase SQL Editor before deploying the payment functions.

create table if not exists public.publication_purchases (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete restrict,
  reference text not null unique,
  buyer_email text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  gateway_transaction_id bigint unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publication_purchases_publication_id_idx
  on public.publication_purchases(publication_id);

alter table public.publication_purchases enable row level security;
revoke all on public.publication_purchases from anon, authenticated;
grant all on public.publication_purchases to service_role;
