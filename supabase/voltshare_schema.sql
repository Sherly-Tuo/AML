-- VoltShare Supabase schema
-- This schema supports:
-- 1. user auth profiles
-- 2. monthly demand-side imports
-- 3. monthly supply-side imports
-- 4. saved pricing recommendation runs
-- 5. import / update audit history

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  postcode text,
  household_type text,
  solar_capacity_kw numeric(8, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

create index if not exists idx_demand_bids_requested_at on public.demand_bids (requested_at desc);
create index if not exists idx_demand_bids_source_month on public.demand_bids (source_month);
create index if not exists idx_supply_reports_reported_at on public.supply_reports (reported_at desc);
create index if not exists idx_supply_reports_source_month on public.supply_reports (source_month);
create index if not exists idx_recommendation_runs_user_id on public.recommendation_runs (user_id, created_at desc);
create index if not exists idx_data_update_runs_dataset_type on public.data_update_runs (dataset_type, updated_at desc);

alter table public.profiles enable row level security;
alter table public.recommendation_runs enable row level security;
alter table public.demand_bids enable row level security;
alter table public.supply_reports enable row level security;
alter table public.data_update_runs enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can read their own recommendation runs" on public.recommendation_runs;
drop policy if exists "Users can insert their own recommendation runs" on public.recommendation_runs;
drop policy if exists "Public can read demand bids" on public.demand_bids;
drop policy if exists "Public can read supply reports" on public.supply_reports;
drop policy if exists "Public can read data update runs" on public.data_update_runs;

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
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
