# VoltShare — Project Context for AI Assistants

## What this is
A peer-to-peer renewable energy trading platform built as an AML (Applied Machine Learning) coursework project. The app demonstrates a grid-search price optimisation algorithm that recommends selling prices based on demand modelling, supply proxies, and weather signals.

## Tech stack
- **Frontend**: Vite + React + TypeScript + Tailwind CSS v3
- **Backend/Auth/DB**: Supabase (Postgres + Auth)
- **State**: Zustand with localStorage persistence (`src/store/index.ts`)
- **Charts**: Recharts
- **Routing**: React Router v6
- **Deployment**: Vercel (vercel.json present) + GitHub Actions for GitHub Pages

## Key file map
```
src/
  pages/
    Intro.tsx              # Landing page (compact, full-screen)
    Auth.tsx               # Email magic link + phone OTP sign-in
    ExperienceHub.tsx      # Choose Dashboard or App; has 4-step interactive tutorial
    AnalyticsDashboard.tsx # AML algorithm explanation with charts/formulas
    Home.tsx               # Analytics dashboard home tab
    MobileHome.tsx         # App mode home screen
    Marketplace.tsx        # P2P listings + buy modal with purchase simulation
    SellEnergy.tsx         # AI price recommendation + listing (writes to Supabase trades)
    ActivityScreen.tsx     # Unified feed: purchases + optimization runs
    WalletScreen.tsx       # Wallet/balance screen
  components/
    AppShell.tsx           # Tab navigation shell for the app mode
    Charts.tsx             # Recharts components (RevenueCurve, HourlyDemandPattern, etc.)
    OnboardingModal.tsx    # First-time signed-in user onboarding (3 steps)
  auth/
    AuthProvider.tsx       # Supabase auth context: session, profile, isFirstTime, requestMagicLink, requestPhoneOtp, verifyPhoneOtp
  store/
    index.ts               # Zustand store v6: marketReports, demandBids, optimizationHistory, purchases
  services/
    aiService.ts           # Core pricing algorithm: grid search over 48 price points, OLS + RF demand model, weather adjustment
  types/
    index.ts               # Shared types: MarketReport, DemandBid, OptimizationRun, Purchase, PricingRecommendation
  lib/
    supabase.ts            # Supabase client (reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

## Supabase schema
Two tables in use:
- **profiles**: id, email, display_name, postcode, onboarded_at, created_at
- **trades**: id, user_id, surplus_kwh, price_per_kwh, expected_revenue, listing_time, created_at

RLS is enabled on both. Auth uses magic link (email OTP) + phone SMS OTP.

## Environment variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Set in `.env.local` locally and in Vercel → Settings → Environment Variables for production.

## Dev server
```bash
npm run dev       # runs on port 4173 (configured in vite.config.ts)
npm run build     # tsc --noEmit && vite build
```

## What's done
- [x] Full auth flow: email magic link, phone OTP, guest mode
- [x] First-time onboarding modal (signed-in users)
- [x] Interactive click-through app tutorial (ExperienceHub → Enter app)
- [x] Analytics dashboard: algorithm explanation, 5+ charts, EB Garamond formula cards
- [x] AI pricing engine (aiService.ts): grid search, OLS/RF demand model, weather multiplier, priceCurve
- [x] SellEnergy: saves trades to Supabase
- [x] Marketplace: buy modal with kWh selector, purchase simulation, success state
- [x] ActivityScreen: unified feed (purchases + sell runs) with summary pills
- [x] Zustand store v6: marketReports, demandBids, optimizationHistory, purchases
- [x] Vercel deployment (vercel.json with SPA rewrites)

## What's NOT done yet (priority order)
1. **recommendation_runs table in Supabase** — optimizer history only in localStorage; needs a `recommendation_runs` table and write in SellEnergy's handleConfirmListing
2. **ActivityScreen reading from Supabase** — currently reads only local zustand state; logged-in users lose history on new device
3. **Buy purchases saved to Supabase** — purchases are local only; could add type='buy' rows to trades table
4. **Vercel 403 fix** — if still showing 403, go to Vercel → Settings → Deployment Protection → disable Vercel Authentication

## Styling conventions
- Tailwind utility classes only, no custom CSS files
- Rounded corners: `rounded-[1.8rem]` to `rounded-[2.3rem]` for cards
- Color palette: emerald-950 (dark green), stone-* (neutrals), emerald-* (accents)
- Shadows: `shadow-[0_18px_40px_rgba(38,84,62,0.08)]` pattern
- Font: EB Garamond loaded via Google Fonts in index.html (used for formula cards)
- Button classes: `primary-btn`, `secondary-btn`, `field-block`, `field-label`, `input-control`, `eyebrow` — defined in src/index.css

## Important notes
- Store version is 6 — bumping requires a migration entry in the `migrate` function
- `VITE_BASE_PATH` env var is used for GitHub Pages subfolder; leave unset on Vercel (defaults to `/`)
- Dev port is 4173, not the default 5173
- Supabase rate limit for magic links is 2/hour by default — raise it in Dashboard → Auth → Rate Limits
