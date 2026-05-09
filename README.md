# VoltShare Pricing Dashboard

VoltShare is an AML classroom project for **household solar listing price recommendation**.

The system combines:

- historical VIC1 demand-side data
- hourly solar supply reference data
- historical weather from Open-Meteo

The goal is to help a solar seller decide:

- **when** to list surplus electricity
- **how much** surplus energy is likely to matter in that hour
- **what asking price** is more reasonable before entering the market

## Project idea

This project is not a pure forecasting dashboard.  
It is a **prediction + optimization** system:

1. Build hourly demand features from historical VIC1 market data
2. Train an `OLS baseline` and a `Random Forest` model
3. Align weather and supply context by hour
4. Search over candidate prices and return an optimized listing price

## Supabase auth setup

The first full-stack step adds Supabase email login around the existing dashboard.

### 1. Frontend environment

Copy `.env.example` to `.env.local` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. Redirect URL

In the Supabase dashboard, add your app URL to Auth redirect URLs. For local development that is usually:

- `http://localhost:4173/auth`
- `http://127.0.0.1:4173/auth`

If you deploy the app, also add the deployed `/auth` URL.

### 3. Profiles table

Run this SQL in Supabase:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  postcode text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

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
```

The current frontend auth flow will upsert a profile row after sign-in, so this table is enough for the first login milestone.

## Supabase database plan

To move VoltShare from a local demo toward a maintained app, the recommended Supabase schema now includes:

- `profiles`
- `demand_bids`
- `supply_reports`
- `recommendation_runs`
- `data_update_runs`

Files:

- SQL schema: [supabase/voltshare_schema.sql](/Users/sherly/Downloads/dashboard/supabase/voltshare_schema.sql:1)
- Monthly update workflow: [docs/monthly-data-update-plan.md](/Users/sherly/Downloads/dashboard/docs/monthly-data-update-plan.md:1)

This design supports:

- user identity and login
- persistent marketplace reference data
- saved pricing recommendation history
- a visible monthly data update process that can be shown to a professor or stakeholder

## Data sources

### Demand-side data

- Raw CSV: [`src/data/price_and_demand_vic1.csv`](/Users/sherly/Downloads/dashboard/src/data/price_and_demand_vic1.csv:1)
- Processed hourly bids: [`src/data/vic1DemandBids.ts`](/Users/sherly/Downloads/dashboard/src/data/vic1DemandBids.ts:1)

### Supply-side data

- Raw CSV: [`src/data/Solar_Energy_Generation.csv`](/Users/sherly/Downloads/dashboard/src/data/Solar_Energy_Generation.csv:1)
- Processed hourly reports: [`src/data/solarSupplyReports.ts`](/Users/sherly/Downloads/dashboard/src/data/solarSupplyReports.ts:1)

### Weather data

- Historical weather API: Open-Meteo archive API
- Alignment logic: [`src/services/weatherService.ts`](/Users/sherly/Downloads/dashboard/src/services/weatherService.ts:1)

## Demand aggregation formulas

The demand-side hourly dataset is derived from 5-minute VIC1 data.

For each hour:

### 1. Hourly demand

`demandKwh = mean(TOTALDEMAND) / 1000`

Interpretation:

- `TOTALDEMAND` is averaged within each hour
- then divided by `1000` to normalize the scale used in this project

### 2. Hourly willingness-to-pay proxy

`maxPricePerKwh = clamp(p90(RRP where RRP > 0) / 1000, 0.02, 0.4)`

Interpretation:

- only positive `RRP` values are used
- the 90th percentile is taken within the hour
- the unit is converted from `$ / MWh` to `$ / kWh` by dividing by `1000`
- the final value is clipped to the range `[0.02, 0.4]`

This is the formula referenced in [`src/data/vic1DemandBids.ts`](/Users/sherly/Downloads/dashboard/src/data/vic1DemandBids.ts:1).

## Supply aggregation formulas

The solar supply reference dataset is derived from quarter-hour solar generation records.

### 1. Positive solar generation only

Only positive quarter-hour `SolarGeneration` values are used.

### 2. Site-hour aggregation

For each site and hour:

`siteHourGeneration = sum(positive quarter-hour SolarGeneration within the hour)`

### 3. Hour-level market reference

For each hour:

`hourlyMedianGeneration = median(siteHourGeneration across active sites)`

### 4. Household-scale surplus approximation

`surplusKwh = hourlyMedianGeneration / 4`

The `/ 4` is the household scale factor used to convert fleet-level generation into a typical household surplus proxy.

### 5. Listing price proxy from abundance

The supply-side listing price is inversely mapped from hourly abundance:

- higher surplus hours imply lower suggested supply-side price
- lower surplus hours imply higher suggested supply-side price

This transformation is described in [`src/data/solarSupplyReports.ts`](/Users/sherly/Downloads/dashboard/src/data/solarSupplyReports.ts:1).

## Weather features

The aligned hourly weather features include:

- `temperatureC`
- `cloudCover`
- `precipitationMm`
- `shortwaveRadiation`
- `directNormalIrradiance`
- `weatherIsDay`

Weather is used in two places:

1. as input features for the demand model
2. as a supply adjustment signal in the pricing simulation

## Feature engineering

The current ML pipeline uses the following features.

### Time features

- hour of day
- month
- day of week
- weekend indicator
- `hourSin`, `hourCos`
- `monthSin`, `monthCos`

### Lag features

- `lagDemand1`
- `lagDemand24`
- `lagPrice1`
- `lagPrice24`
- `rollingDemand24`
- `rollingPrice24`

### Extra interaction features for Random Forest

- `logPrice_x_isWeekend`
- `logPrice_x_hourSin`
- `logPrice_x_hourCos`
- `lagDemandDelta = lagDemand1 - lagDemand24`
- `lagPriceDelta = lagPrice1 - lagPrice24`
- `rollingDemandDelta = rollingDemand24 - lagDemand24`

## Modeling formulas

The model logic is implemented in [`src/services/aiService.ts`](/Users/sherly/Downloads/dashboard/src/services/aiService.ts:1).

### 1. OLS baseline

The OLS baseline predicts:

`logDemand = log(demandKwh)`

The prediction is then converted back:

`predictedDemand = exp(predictedLogDemand)`

This gives an interpretable linear baseline.

### 2. Random Forest

The Random Forest directly predicts:

`predictedDemand = f(price, time, lag features, weather features)`

It is intended to capture nonlinear relationships between demand, price, time, and weather.

## Weather adjustment formulas

After demand is predicted, weather is also used to modify the scenario.

### 1. Weather demand multiplier

The current implementation uses:

`weatherDemandMultiplier = clamp(1 + precipitationMm * 0.012 + cloudCover * 0.0008 + max(18 - temperatureC, 0) * 0.008 + max(temperatureC - 28, 0) * 0.01 - shortwaveRadiation * 0.00018, 0.72, 1.35)`

Interpretation:

- more precipitation and cloud cover slightly increase demand pressure
- very cold or very hot temperatures increase demand
- stronger solar radiation reduces demand pressure slightly

### 2. Weather supply adjustment

The current implementation uses:

`weatherSupplyAdjustment = clamp((shortwaveRadiation - 240) * 0.0026 + (directNormalIrradiance - 300) * 0.0014 - cloudCover * 0.018 - precipitationMm * 0.55 + (weatherIsDay == 0 ? -0.55 : 0), -0.9 * surplusKwh, 0.9 * surplusKwh)`

Interpretation:

- more radiation increases expected available supply
- more cloud and rain reduce supply
- night-time hours reduce supply sharply

## Market reference formulas

### 1. Weighted average supply price

`weightedAverageSupplyPrice = sum(surplusKwh_i * price_i) / sum(surplusKwh_i)`

### 2. Weighted average demand bid

`weightedAverageDemandBid = sum(demandKwh_i * maxPrice_i) / sum(demandKwh_i)`

### 3. Percentile-based price anchors

The optimization layer uses:

- `p10`
- `p35`
- `p70`
- `p85`
- `p95`

from historical demand bid prices to define pricing ranges and competitiveness labels.

## Price optimization logic

The pricing engine does not output a fixed market price for everyone.  
It recommends an asking price for one seller in one listing scenario.

### 1. FiT opportunity cost proxy

`fitPrice = clamp(p15(supply reference prices), 0.02, 0.3)`

This acts as the opportunity cost of using peer-to-peer selling instead of a feed-in tariff style alternative.

### 2. Retail replacement cost proxy

`retailTariff = clamp(max(p85(demand prices), fitPrice + 0.03), fitPrice + 0.03, 0.45)`

This acts as the shortfall replacement cost proxy.

### 3. Price search bounds

`priceFloor = clamp(max(fitPrice + 0.005, p10 * 0.8), fitPrice + 0.005, retailTariff)`

`priceCeiling = clamp(max(priceFloor + 0.02, p95 * 1.02), priceFloor + 0.02, retailTariff)`

### 4. Candidate grid

The system evaluates a grid of candidate prices between `priceFloor` and `priceCeiling`, plus the user's input price.

### 5. Market share response

The current system uses a logistic price response function:

`marketShare = 1 / (1 + exp(steepness * (candidatePrice - midpoint)))`

where:

- `midpoint = (fitPrice + retailTariff) / 2`
- `steepness = 8 / (retailTariff - fitPrice)`

This reflects the idea that as the listing price approaches the outside option, demand share shrinks.

### 6. Scenario profit

For each simulated scenario:

- `availableSupply = max(0, inputSurplus + weatherSupplyAdjustment + supplyResidual)`
- `simulatedDemand = (predictedDemand + demandResidual) * marketShare`
- `ownSupplyUsed = min(simulatedDemand, availableSupply)`
- `shortfall = max(0, simulatedDemand - availableSupply)`

Expected profit is computed as:

`profit = ownSupplyUsed * (candidatePrice - fitPrice) - shortfall * max(retailTariff - candidatePrice, 0)`

The final recommended price is the candidate with the highest expected profit across sampled residual scenarios.

## Model performance

From the current AML notebook pipeline, the test-set results are:

| Model | RMSE | MAE | R² |
| --- | --- | --- | --- |
| OLS baseline | 0.3405 | 0.2211 | 0.8990 |
| Random Forest | 0.2892 | 0.1798 | 0.9272 |

This shows that the Random Forest outperformed the OLS baseline across all reported evaluation metrics.

## Current limitation: no postcode or neighbor validation

The current raw datasets do **not** contain:

- postcode
- street address
- meter identifier
- feeder-level network location

This means the current prototype cannot verify whether two participants are true local neighbors inside the same eligible shared-energy area.

So, the current system should be interpreted as:

- a **regional pricing recommendation prototype**

and not yet as:

- a full **location-validated shared-energy trading platform**

In a production system, postcode-level or meter-level validation would likely be required to confirm local trading eligibility.

## Dashboard output

The dashboard returns:

- optimized listing price
- expected revenue
- revenue change versus the input price
- expected shortfall
- expected own-supply usage
- comparable supply references
- comparable demand references
- weather explanation

This makes the project a decision-support tool rather than only a forecasting exercise.

## Main implementation files

- Dashboard page: [`src/pages/Home.tsx`](/Users/sherly/Downloads/dashboard/src/pages/Home.tsx:1)
- Pricing logic: [`src/services/aiService.ts`](/Users/sherly/Downloads/dashboard/src/services/aiService.ts:1)
- Weather alignment: [`src/services/weatherService.ts`](/Users/sherly/Downloads/dashboard/src/services/weatherService.ts:1)
- Store: [`src/store/index.ts`](/Users/sherly/Downloads/dashboard/src/store/index.ts:1)
- Assignment draft: [AML_ASSIGNMENT_DRAFT.md](/Users/sherly/Downloads/dashboard/AML_ASSIGNMENT_DRAFT.md:1)

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
