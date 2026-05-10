# VoltShare Handoff Guide

This file is for teammates who will continue building VoltShare after the current AML + product demo milestone.

## 1. What VoltShare is

VoltShare is a Columbia SIPA AML project and product prototype for peer-to-peer renewable energy trading.

The project has two connected layers:

- `Analytics dashboard`
  Explains the AML logic, generated datasets, pricing workflow, backend concept, and policy relevance.
- `User-facing app`
  Simulates how a real user would sign in, view recommendations, list surplus energy, buy local energy, and review wallet/activity history.

## 2. Current stack

- Frontend: `Vite + React + TypeScript`
- Styling: `Tailwind CSS`
- State: `Zustand`
- Backend/Auth/DB: `Supabase`
- Deployment: `Vercel`
- Code source: `GitHub`

## 3. Live systems

- GitHub repo: `https://github.com/Sherly-Tuo/AML`
- Vercel project: `aml`
- Supabase project: `voltshare`

## 4. Collaboration setup

Recommended collaboration model:

- GitHub = source of truth for code
- Vercel = deployment and environment variables
- Supabase = auth, database, and backend records

Do **not** rely on passing zip files around as the main workflow.

Recommended access:

1. Add teammates as collaborators on GitHub
2. Add teammates to the Vercel project/team
3. Add teammates to the Supabase project

This is better than signing into the owner account on someone else’s laptop.

## 5. Local setup

### Clone

```bash
git clone https://github.com/Sherly-Tuo/AML.git
cd AML
npm install
```

### Environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

These values should match the current Supabase project.

### Run locally

```bash
npm run dev
```

Local app usually runs on:

- `http://localhost:4173`
- `http://127.0.0.1:4173`

### Build

```bash
npm run build
```

## 6. Supabase setup

Important redirect URLs:

- `http://localhost:4173/auth`
- `http://127.0.0.1:4173/auth`
- `https://aml-sandy.vercel.app`
- `https://aml-sandy.vercel.app/auth`

Run the latest schema in:

- [supabase/voltshare_schema.sql](/Users/sherly/Downloads/dashboard/supabase/voltshare_schema.sql:1)

This schema includes core product tables such as:

- `profiles`
- `recommendation_runs`
- `listings`
- `transactions`
- `purchases`
- `wallet_credit_events`
- `app_events`

## 7. Main app routes

- `/` = landing page
- `/auth` = sign in / create account / password reset
- `/experience` = choose dashboard vs app
- `/analytics` = AML academic dashboard
- `/app` = app home
- `/app/market` = Buy
- `/app/sell` = Sell
- `/app/activity` = My Activity
- `/app/wallet` = Wallet

## 8. What is already working

- Email + password auth via Supabase
- Recommendation flow in Sell
- Listings written to Supabase
- Buy page reads active listings from Supabase
- Purchases create transaction records
- Wallet reads remote transaction/credit state
- Promo code flow
- Guided onboarding
- AML analytics dashboard
- Vercel deployment

## 9. Known limitations / rough edges

These are the main issues the next teammate should know:

1. `Avatar upload`
   Frontend fallback exists, but Supabase `profiles` trigger / `updated_at` behavior may still need cleanup.

2. `Phone login`
   Not production-ready. Supabase phone auth requires Twilio or another configured SMS provider.

3. `Guest mode`
   Guest state is browser-local only. It is not a stable cross-device identity.

4. `Onboarding polish`
   Guided onboarding is functional but may still need spacing / highlight / motion refinement.

5. `Marketplace realism`
   Listing lifecycle exists, but seller controls and buyer-side marketplace logic can still be improved.

6. `Analytics clarity`
   The academic dashboard is much stronger now, but future iterations may still refine how product data and AML outputs are explained.

## 10. Recommended next priorities

Suggested order for continuing development:

1. Fix `profiles` avatar persistence cleanly in Supabase
2. Improve listing management
   - hide or flag own listings in Buy
   - better status lifecycle
3. Improve onboarding polish
4. Strengthen wallet / credit history UI
5. Add more realistic admin / analytics views
6. If needed later, add production-ready payment integration
7. If needed later, add production-ready SMS auth

## 11. Product logic summary

At a high level:

- Demand side uses generated buyer-side proxy bids from VIC1 data
- Supply side uses aggregated solar surplus proxies
- Weather provides local context
- OLS + Random Forest support the recommendation layer
- A price optimization step recommends the listing price
- The app then simulates how users interact with those outputs

## 12. Files to read first

For a teammate taking over, start with:

- [README.md](/Users/sherly/Downloads/dashboard/README.md:1)
- [CLAUDE.md](/Users/sherly/Downloads/dashboard/CLAUDE.md:1)
- [supabase/voltshare_schema.sql](/Users/sherly/Downloads/dashboard/supabase/voltshare_schema.sql:1)
- [src/pages/AnalyticsDashboard.tsx](/Users/sherly/Downloads/dashboard/src/pages/AnalyticsDashboard.tsx:1)
- [src/pages/MobileHome.tsx](/Users/sherly/Downloads/dashboard/src/pages/MobileHome.tsx:1)
- [src/pages/SellEnergy.tsx](/Users/sherly/Downloads/dashboard/src/pages/SellEnergy.tsx:1)
- [src/pages/Marketplace.tsx](/Users/sherly/Downloads/dashboard/src/pages/Marketplace.tsx:1)
- [src/pages/WalletScreen.tsx](/Users/sherly/Downloads/dashboard/src/pages/WalletScreen.tsx:1)
- [src/auth/AuthProvider.tsx](/Users/sherly/Downloads/dashboard/src/auth/AuthProvider.tsx:1)

## 13. Short handoff message you can send

You can send this to your teammate:

> VoltShare is in GitHub and deployed on Vercel, with Supabase as the backend. Please start by reading `README.md`, `CLAUDE.md`, and `HANDOFF.md`. Then clone the repo, set up `.env.local`, and run the latest Supabase schema. The current build already supports auth, listings, transactions, wallet credits, and the AML dashboard. The next tasks are mainly polish, backend cleanup, and improving product realism.
