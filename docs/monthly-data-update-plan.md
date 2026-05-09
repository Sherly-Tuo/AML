# VoltShare Monthly Data Update Plan

This document explains how VoltShare should update its marketplace data each month once the project moves from a static classroom demo toward a maintained app.

## Why monthly updates are needed

VoltShare depends on historical demand-side and supply-side reference data.

If those references never change:

- the dashboard becomes stale
- the app reflects old market conditions
- the pricing recommendation slowly becomes less believable

So the intended operational model is:

1. an engineer receives fresh raw files each month
2. the files are aggregated into VoltShare-ready hourly tables
3. the new rows are written into Supabase
4. the app and dashboard automatically read the latest records

## Data sources to update

### 1. Demand-side data

Raw input:

- `PRICE_AND_DEMAND_YYYYMM_YYYYMM_VIC1_merged.csv`

Output table:

- `public.demand_bids`

Important transform:

- `demand_kwh = mean(TOTALDEMAND) / 1000`
- `max_price_per_kwh = clamp(p90(RRP > 0) / 1000, 0.02, 0.4)`

### 2. Supply-side data

Raw input:

- `Solar_Energy_Generation.csv`

Output table:

- `public.supply_reports`

Important transform:

- aggregate positive quarter-hour solar generation into site-hour generation
- take the hourly median across active sites
- scale by `/4` to approximate household surplus

### 3. Optional weather cache

Raw input:

- Open-Meteo historical weather export

Suggested future table:

- `weather_hourly_cache`

This table is not required for the first schema milestone, but it is a natural future extension if you want repeatable historical replay without refetching API data.

## Monthly update workflow

### Step 1. Receive raw files

The engineer receives the latest monthly raw demand and solar files.

Suggested naming:

- `price_and_demand_vic1_2026_05.csv`
- `solar_generation_2026_05.csv`

### Step 2. Run aggregation scripts

The engineer runs the project scripts or notebook pipeline that:

- clean the raw rows
- aggregate them to hourly records
- generate VoltShare-ready demand and supply rows

### Step 3. Create an update log row

Before or after import, create one row in:

- `public.data_update_runs`

This records:

- which dataset was updated
- which source file was used
- how many rows were imported
- when the update happened
- who performed it

This table is useful for:

- engineering operations
- professor/demo visibility
- reproducibility

### Step 4. Import into Supabase

The engineer loads the fresh rows into:

- `public.demand_bids`
- `public.supply_reports`

Each imported row should keep:

- `source_month`
- `update_run_id`

That makes it possible to explain:

- where a row came from
- which monthly import created it

### Step 5. Validate totals

After import, check:

- demand row count
- supply row count
- min / max timestamps
- average prices
- average surplus

This is a lightweight sanity check before the new month becomes visible in the app.

### Step 6. Frontend reads latest data

Once Supabase contains the new rows:

- the dashboard can show new totals
- the app can use fresh marketplace context
- the recommendation engine can use updated references

## What the professor can be shown

To make the backend and data lifecycle visible in the dashboard, add a small "Data Operations" block that shows:

- latest demand update month
- latest supply update month
- rows imported in the last update
- last update timestamp
- update engineer / updater identity

This helps explain that VoltShare is not only a static demo, but a system with a maintainable data pipeline.

## MVP recommendation

For the next implementation step, the most valuable database-backed flow is:

1. keep `profiles` for user identity
2. move `recommendation_runs` into Supabase
3. create `demand_bids`, `supply_reports`, and `data_update_runs`
4. later replace the current local seed data with Supabase reads

That gives VoltShare:

- frontend
- auth
- database
- operational update logic

which is enough to justify calling it a real early-stage full-stack product prototype.
