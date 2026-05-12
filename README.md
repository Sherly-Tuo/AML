# VoltShare — AML Final Project

**Columbia SIPA · Applying Machine Learning · Prof. Daniel Björkegren · May 2026**

---

## Research Question

> **Can ML-based dynamic pricing in peer-to-peer renewable energy markets systematically improve household seller revenue compared to fixed grid feed-in tariffs (FiT), and under what demand and weather conditions is the gain largest?**

Using Victoria (VIC1) electricity market data and Melbourne solar generation records, we build an OLS baseline and a Random Forest demand model, then run a grid-search price optimiser to show that ML-recommended prices outperform the FiT baseline in expected profit — with the largest gains during high-demand, low-supply hours. This has direct policy relevance: if P2P pricing incentives are strong enough, households are more likely to invest in rooftop solar and actively participate in local energy sharing.

The full algorithm explanation, data pipeline, model evaluation metrics (OLS vs. Random Forest R², RMSE, MAE), and pricing formula derivations are in the standalone analytics page linked below.

---

## What VoltShare is

VoltShare is a peer-to-peer renewable energy trading prototype. The academic analysis (data pipeline, ML models, pricing algorithm) is presented in a standalone analytics page. Separately, we built an app demo to simulate how the ML pricing output would work inside a real user-facing marketplace.

- **Analytics page** — for the professor: data pipeline, OLS + Random Forest demand modelling, grid-search pricing, model evaluation, and formula derivations.
- **App demo** — a simulated product: list surplus solar energy at an ML-optimised price, browse and buy listings from neighbours, track activity and wallet balance.

The pricing algorithm uses:
1. Hourly demand features from VIC1 market data (OLS + Random Forest)
2. Hourly solar supply proxy from Melbourne solar generation records
3. Historical weather from Open-Meteo (temperature, cloud cover, radiation)
4. Grid search over 48 candidate prices to maximise expected profit relative to the FiT opportunity cost

---

## Try the demo

**Standalone analytics page** (algorithm explanation, model evaluation, formula derivations): [https://sherly-tuo.github.io/AML/analytics.html](https://sherly-tuo.github.io/AML/analytics.html)

**Live app demo:** https://aml-sandy.vercel.app

1. Open the link → click **Enter demo** (no account needed)
2. Try the product flow:
   - **Sell** — enter your surplus kWh and listing hour → get an ML-optimised price recommendation
   - **Buy** — browse active listings from neighbours
   - **Activity** — view your pricing runs and purchase history
   - **Wallet** — check balance; try promo code `AGRADEPROJECT` for a demo credit

---

## Run locally

```bash
git clone https://github.com/Sherly-Tuo/AML.git
cd AML
npm install
npm run dev
# App runs at http://localhost:4173
```

No environment variables are required to run the demo — the app works fully without Supabase (all state is local). To enable cloud sync, add `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Run the ML notebook

The full Python ML pipeline (OLS, Random Forest, weather ablation, grid-search pricing) is in:

```
notebooks/voltshare_pricing_ml.ipynb
```

Requirements: `scikit-learn`, `pandas`, `numpy`, `statsmodels`, `matplotlib` (auto-installed on first run).

Data files required (already in repo):
- `src/data/price_and_demand_vic1.csv` — VIC1 half-hourly demand & price
- `src/data/Solar_Energy_Generation.csv` — Melbourne solar generation
- `src/data/open_meteo_melbourne_hourly.csv` — historical weather cache

---

## Project structure

```
src/
  pages/
    AnalyticsDashboard.tsx   # Algorithm explanation + charts + model evaluation
    SellEnergy.tsx           # ML pricing recommendation UI
    Marketplace.tsx          # P2P listings (buy)
    ActivityScreen.tsx       # Unified history feed
    WalletScreen.tsx         # Balance + transactions
  services/
    aiService.ts             # Core pricing algorithm: OLS, Random Forest, grid search
    weatherService.ts        # Open-Meteo weather alignment
  store/
    index.ts                 # Zustand state (Zustand v6, localStorage-persisted)
  data/
    vic1DemandBids.ts        # Pre-processed VIC1 hourly demand bids
    solarSupplyReports.ts    # Pre-processed hourly solar supply reference
notebooks/
  voltshare_pricing_ml.ipynb # Full Python ML pipeline
```

---

## Data sources

| Dataset | Source | Use |
|---------|--------|-----|
| VIC1 electricity demand & price | AEMO 5-min dispatch data | Demand model training |
| Solar generation records | APVI / ARENA open data | Supply proxy |
| Melbourne historical weather | Open-Meteo archive API | Weather features + supply adjustment |

---

## Model performance (from notebook)

| Model | RMSE | MAE | R² |
|-------|------|-----|----|
| OLS baseline | 0.3405 | 0.2211 | 0.8990 |
| Random Forest (no weather) | 0.2892 | 0.1798 | 0.9272 |
| Random Forest (with weather) | 0.2933 | 0.1822 | 0.9251 |

Weather features did not significantly improve test-set accuracy with the current single-location proxy — this is discussed in the notebook and the Analytics Dashboard as a limitation and direction for future work.

---

## Tech stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS v3
- **State**: Zustand with localStorage persistence
- **Backend/Auth/DB**: Supabase (optional for demo)
- **Deployment**: Vercel
