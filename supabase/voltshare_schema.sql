-- VoltShare Supabase schema
-- This schema supports:
-- 1. user auth profiles
-- 2. monthly demand-side imports
-- 3. monthly supply-side imports
-- 4. saved pricing recommendation runs
-- 5. live peer-to-peer listings
-- 6. completed marketplace transactions
-- 7. wallet credit ledger
-- 8. import / update audit history

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  postcode text,
  onboarded_at timestamptz,
  avatar_url text,
  household_type text,
  solar_capacity_kw numeric(8, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists onboarded_at timestamptz;
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.data_update_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_type text not null check (dataset_type in ('demand_bids', 'supply_reports', 'weather_cache', 'synthetic_users')),
  source_file text not null,
  source_month text,
  records_imported integer not null default 0,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.demand_bids (
  id uuid primary key default gen_random_uuid(),
  buyer_name text not null,
  demand_kwh numeric(12, 2) not null check (demand_kwh > 0),
  max_price_per_kwh numeric(10, 4) not null check (max_price_per_kwh > 0),
  requested_at timestamptz not null,
  region text not null default 'VIC1',
  source_month text,
  update_run_id uuid references public.data_update_runs (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supply_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_name text not null,
  surplus_kwh numeric(12, 2) not null check (surplus_kwh > 0),
  price_per_kwh numeric(10, 4) not null check (price_per_kwh > 0),
  reported_at timestamptz not null,
  source_month text,
  update_run_id uuid references public.data_update_runs (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_time timestamptz not null,
  surplus_kwh numeric(12, 2) not null check (surplus_kwh > 0),
  input_price numeric(10, 4) not null check (input_price > 0),
  optimized_price numeric(10, 4) not null check (optimized_price > 0),
  expected_revenue numeric(12, 2) not null,
  weather_summary text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recommendation_run_id uuid references public.recommendation_runs (id) on delete set null,
  title text,
  source_type text not null default 'solar' check (source_type in ('solar', 'wind', 'battery', 'mixed')),
  postcode text,
  suburb text,
  surplus_kwh numeric(12, 2) not null check (surplus_kwh > 0),
  listed_price_per_kwh numeric(10, 4) not null check (listed_price_per_kwh > 0),
  estimated_revenue numeric(12, 2),
  status text not null default 'active' check (status in ('draft', 'active', 'partially_filled', 'sold', 'cancelled', 'expired')),
  visibility text not null default 'public' check (visibility in ('public', 'private', 'neighbors_only')),
  available_from timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_user_id uuid not null references public.profiles (id) on delete cascade,
  seller_user_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null check (source_type in ('solar', 'wind', 'battery', 'mixed')),
  postcode text,
  suburb text,
  kwh_traded numeric(12, 2) not null check (kwh_traded > 0),
  agreed_price_per_kwh numeric(10, 4) not null check (agreed_price_per_kwh > 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'completed' check (status in ('pending', 'completed', 'cancelled', 'refunded')),
  purchased_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in ('promo_code', 'manual_top_up', 'adjustment')),
  amount numeric(12, 2) not null,
  promo_code text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  seller_neighborhood text not null,
  source text not null,
  kwh_bought numeric(12, 2) not null check (kwh_bought > 0),
  price_per_kwh numeric(10, 4) not null check (price_per_kwh > 0),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  bought_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_name text not null,
  screen text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_demand_bids_requested_at on public.demand_bids (requested_at desc);
create index if not exists idx_demand_bids_source_month on public.demand_bids (source_month);
create index if not exists idx_supply_reports_reported_at on public.supply_reports (reported_at desc);
create index if not exists idx_supply_reports_source_month on public.supply_reports (source_month);
create index if not exists idx_recommendation_runs_user_id on public.recommendation_runs (user_id, created_at desc);
create index if not exists idx_listings_user_id on public.listings (user_id, created_at desc);
create index if not exists idx_listings_status on public.listings (status, created_at desc);
create index if not exists idx_listings_postcode on public.listings (postcode, created_at desc);
create index if not exists idx_transactions_listing_id on public.transactions (listing_id, purchased_at desc);
create index if not exists idx_transactions_buyer_user_id on public.transactions (buyer_user_id, purchased_at desc);
create index if not exists idx_transactions_seller_user_id on public.transactions (seller_user_id, purchased_at desc);
create index if not exists idx_wallet_credit_events_user_id on public.wallet_credit_events (user_id, created_at desc);
create index if not exists idx_purchases_user_id on public.purchases (user_id, bought_at desc);
create index if not exists idx_data_update_runs_dataset_type on public.data_update_runs (dataset_type, updated_at desc);
create index if not exists idx_app_events_created_at on public.app_events (created_at desc);
create index if not exists idx_app_events_name on public.app_events (event_name, created_at desc);

alter table public.profiles enable row level security;
alter table public.recommendation_runs enable row level security;
alter table public.listings enable row level security;
alter table public.transactions enable row level security;
alter table public.wallet_credit_events enable row level security;
alter table public.purchases enable row level security;
alter table public.demand_bids enable row level security;
alter table public.supply_reports enable row level security;
alter table public.data_update_runs enable row level security;
alter table public.app_events enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can read their own recommendation runs" on public.recommendation_runs;
drop policy if exists "Users can insert their own recommendation runs" on public.recommendation_runs;
drop policy if exists "Public can read active listings" on public.listings;
drop policy if exists "Users can read their own listings" on public.listings;
drop policy if exists "Users can insert their own listings" on public.listings;
drop policy if exists "Users can update their own listings" on public.listings;
drop policy if exists "Users can read their own transactions" on public.transactions;
drop policy if exists "Users can insert their own transactions" on public.transactions;
drop policy if exists "Users can read their own wallet credit events" on public.wallet_credit_events;
drop policy if exists "Users can insert their own wallet credit events" on public.wallet_credit_events;
drop policy if exists "Users can read their own purchases" on public.purchases;
drop policy if exists "Users can insert their own purchases" on public.purchases;
drop policy if exists "Public can read demand bids" on public.demand_bids;
drop policy if exists "Public can read supply reports" on public.supply_reports;
drop policy if exists "Public can read data update runs" on public.data_update_runs;
drop policy if exists "Public can read app events" on public.app_events;
drop policy if exists "Users can insert their own app events" on public.app_events;

create policy "Users can read their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id);

create policy "Users can read their own recommendation runs"
on public.recommendation_runs
for select
using (auth.uid() = user_id);

create policy "Users can insert their own recommendation runs"
on public.recommendation_runs
for insert
with check (auth.uid() = user_id);

create policy "Public can read active listings"
on public.listings
for select
using (status in ('active', 'partially_filled'));

create policy "Users can read their own listings"
on public.listings
for select
using (auth.uid() = user_id);

create policy "Users can insert their own listings"
on public.listings
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own listings"
on public.listings
for update
using (auth.uid() = user_id);

create policy "Users can read their own transactions"
on public.transactions
for select
using (auth.uid() = buyer_user_id or auth.uid() = seller_user_id);

create policy "Users can insert their own transactions"
on public.transactions
for insert
with check (auth.uid() = buyer_user_id);

create policy "Users can read their own wallet credit events"
on public.wallet_credit_events
for select
using (auth.uid() = user_id);

create policy "Users can insert their own wallet credit events"
on public.wallet_credit_events
for insert
with check (auth.uid() = user_id);

create policy "Users can read their own purchases"
on public.purchases
for select
using (auth.uid() = user_id);

create policy "Users can insert their own purchases"
on public.purchases
for insert
with check (auth.uid() = user_id);

create policy "Public can read demand bids"
on public.demand_bids
for select
using (true);

create policy "Public can read supply reports"
on public.supply_reports
for select
using (true);

create policy "Public can read data update runs"
on public.data_update_runs
for select
using (true);

create policy "Public can read app events"
on public.app_events
for select
using (true);

create policy "Users can insert their own app events"
on public.app_events
for insert
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger trg_listings_updated_at
before update on public.listings
for each row
execute function public.set_updated_at();
