# VoltShare Pricing Dashboard

This project is an AML classroom demo for peer-to-peer solar electricity pricing.

It combines:

- historical VIC1 demand-side data
- hourly aggregated solar supply data
- historical weather from Open-Meteo

The dashboard helps a household solar seller estimate a more reasonable listing price before entering the market.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Main idea

The system aligns historical demand, supply, and weather by hour, then uses feature engineering, an OLS baseline, a Random Forest model, and grid search to recommend an optimized listing price.
