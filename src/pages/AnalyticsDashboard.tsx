import { BarChart3, CloudSun, Coins, Leaf, Sparkles, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { defaultDemandDatasetMeta } from '@/data/vic1DemandBids';
import { defaultSupplyDatasetMeta } from '@/data/solarSupplyReports';
import { formatDateTime } from '@/lib/datetime';
import { calculateOptimizedPricing, getDemandStats, getMarketStats } from '@/services/aiService';
import { defaultWeatherLocation } from '@/services/weatherService';
import { useStore } from '@/store';
import type { PricingRecommendation } from '@/types';
import { HourlyDemandPattern, ModelComparisonChart, PriceSpreadChart, RevenueCurve, SupplyScatter } from '@/components/Charts';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const syntheticUsers = [
  {
    name: 'Maple Home',
    role: 'Solar seller',
    note: 'A suburban household with rooftop solar and regular midday surplus.',
    postcode: '3070 (simulated)',
  },
  {
    name: 'Battery Couple',
    role: 'Flexible seller',
    note: 'Stores part of the daytime generation and sells more strategically in the evening.',
    postcode: '3058 (simulated)',
  },
  {
    name: 'EV Commuter',
    role: 'Demand-side buyer',
    note: 'Needs charging in the evening and accepts higher prices when local supply tightens.',
    postcode: '3068 (simulated)',
  },
  {
    name: 'Corner Bakery',
    role: 'Small business buyer',
    note: 'Shows stronger daytime demand and helps demonstrate community trading behavior.',
    postcode: '3011 (simulated)',
  },
] as const;

export default function AnalyticsDashboard() {
  const marketReports = useStore((state) => state.marketReports);
  const demandBids = useStore((state) => state.demandBids);
  const saveOptimizationRun = useStore((state) => state.saveOptimizationRun);

  const marketStats = getMarketStats(marketReports);
  const demandStats = getDemandStats(demandBids);
  const demandSample = useMemo(() => demandBids.slice(0, 120), [demandBids]);
  const supplySample = useMemo(() => marketReports.slice(0, 120), [marketReports]);
  const strongestSupplyHour = useMemo(
    () => [...marketReports].sort((a, b) => b.surplusKwh - a.surplusKwh)[0] ?? null,
    [marketReports],
  );

  const [listingTime, setListingTime] = useState(defaultDemandDatasetMeta.endDate.slice(0, 16));
  const [mySurplusKwh, setMySurplusKwh] = useState(strongestSupplyHour?.surplusKwh.toFixed(1) ?? '5.5');
  const [myPrice, setMyPrice] = useState(strongestSupplyHour?.pricePerKwh.toFixed(3) ?? '0.180');
  const [pricingError, setPricingError] = useState('');
  const [recommendation, setRecommendation] = useState<PricingRecommendation | null>(null);

  // Supply scatter: each market report as a {kwh, price} point (sample up to 300)
  const supplyScatterData = useMemo(
    () => marketReports.slice(0, 300).map((r) => ({ kwh: r.surplusKwh, price: r.pricePerKwh })),
    [marketReports],
  );

  // Price spread by hour-of-day: avg supply price vs avg demand bid
  const priceSpreadData = useMemo(() => {
    const supplyBuckets = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
    for (const r of marketReports) {
      const h = new Date(r.reportedAt).getUTCHours();
      if (h >= 0 && h < 24) { supplyBuckets[h].total += r.pricePerKwh; supplyBuckets[h].count += 1; }
    }
    const demandBuckets = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
    for (const b of demandBids) {
      const h = new Date(b.requestedAt).getUTCHours();
      if (h >= 0 && h < 24) { demandBuckets[h].total += b.maxPricePerKwh; demandBuckets[h].count += 1; }
    }
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      supplyPrice: supplyBuckets[hour].count > 0 ? supplyBuckets[hour].total / supplyBuckets[hour].count : 0,
      demandBid: demandBuckets[hour].count > 0 ? demandBuckets[hour].total / demandBuckets[hour].count : 0,
    }));
  }, [marketReports, demandBids]);

  // Hourly demand pattern: average kWh per hour-of-day across the dataset
  const hourlyDemandData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, count: 0, bidTotal: 0 }));
    for (const bid of demandBids) {
      const h = new Date(bid.requestedAt).getUTCHours();
      if (h >= 0 && h < 24) {
        buckets[h].total += bid.demandKwh;
        buckets[h].count += 1;
        buckets[h].bidTotal += bid.maxPricePerKwh;
      }
    }
    return buckets.map(({ hour, total, count, bidTotal }) => ({
      hour,
      avgDemand: count > 0 ? total / count : 0,
      avgBid: count > 0 ? bidTotal / count : 0,
    }));
  }, [demandBids]);

  const handleOptimize = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedKwh = Number(mySurplusKwh);
    const parsedPrice = Number(myPrice);

    if (!Number.isFinite(parsedKwh) || parsedKwh <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPricingError('Enter a valid surplus energy value and target price.');
      return;
    }

    const result = calculateOptimizedPricing(
      {
        surplusKwh: parsedKwh,
        targetPrice: parsedPrice,
        listingTime,
      },
      marketReports,
      demandBids,
      [],
    );

    setRecommendation(result);
    setPricingError('');
    saveOptimizationRun({
      surplusKwh: parsedKwh,
      inputPrice: parsedPrice,
      optimizedPrice: result.optimizedPrice,
      expectedRevenue: result.expectedRevenue,
    });
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="hero-panel">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="eyebrow">VoltShare Analytics</p>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                  Algorithm Explanation
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-700 sm:text-lg">
                  This dashboard is the AML coursework view of VoltShare. Its purpose is to explain how the app’s recommendation engine is built from generated demand-side and supply-side datasets, and how those datasets support optimal price generation.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-950">
                Core purpose: demonstrate the algorithm behind VoltShare rather than the app interface itself.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ModeCard
                  label="Dashboard mode"
                  icon="📊"
                  heading="Algorithm view"
                  description="Explore how VoltShare's pricing engine works — from raw energy datasets to demand models, supply proxies, and optimal price generation. No sign-in required."
                  badge="You are here"
                  badgeStyle="emerald"
                />
                <ModeCard
                  label="App mode"
                  icon="⚡"
                  heading="Live trading"
                  description="Sign in to buy or sell surplus energy with your neighbors. Every completed sale is recorded to your account, and your trading history refreshes each month."
                  badge="Requires sign-in"
                  badgeStyle="amber"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                icon={Leaf}
                label="Supply records"
                value={`${marketStats.reportCount}`}
                note="Hourly surplus reference points"
                source={defaultSupplyDatasetMeta.sourceFile}
              />
              <MetricCard
                icon={BarChart3}
                label="Demand records"
                value={`${demandStats.bidCount}`}
                note="Hourly buyer-side proxy bids"
                source={defaultDemandDatasetMeta.sourceFile}
              />
              <MetricCard icon={Coins} label="Avg supply price" value={`${marketStats.averagePrice.toFixed(3)}/kWh`} note="Supply-weighted market reference" />
              <MetricCard
                icon={CloudSun}
                label="Weather proxy"
                value={defaultWeatherLocation.label}
                note="Open-Meteo historical weather aligned by hour"
                source="Used to add solar availability and demand-pressure context"
              />
            </div>
          </div>
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 1</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Generated databases and model pipeline</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              VoltShare does not read raw CSVs directly inside the app. Instead, it first generates structured hourly databases, then joins them by timestamp before modeling and recommendation.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard
              title="Demand database"
              body="The demand-side dataset comes from the VIC1 price-demand file. We combine hourly normalized demand quantity with a buyer-side willingness-to-pay proxy and then model it with OLS and Random Forest."
            />
            <InfoCard
              title="Supply database"
              body="The supply-side dataset comes from quarter-hour solar generation. We aggregate it into hourly household-scale surplus estimates and create supply-side price reference points from those hourly conditions."
            />
            <InfoCard
              title="Price optimization context"
              body="The price optimization layer joins time features, lag features, supply context, and weather context. It then evaluates candidate listing prices and keeps the one with the strongest expected net revenue."
            />
          </div>

          <div className="rounded-[1.7rem] border border-stone-200/70 bg-white/80 p-5">
            <p className="text-sm leading-7 text-stone-700">
              Pipeline summary: the demand dataset is generated from regional VIC1 market rows, the supply dataset is generated from solar generation records, and the optimization context is generated by aligning time, lag, and weather features at the same hourly timestamp. This is how the app gets from raw energy data to a user-facing recommended listing price.
            </p>
          </div>

          <div className="rounded-[1.7rem] border border-amber-200/60 bg-[linear-gradient(150deg,rgba(255,254,249,0.98),rgba(253,247,233,0.90))] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Supply price vs demand bid — by hour of day</p>
            <p className="mt-1 text-sm text-stone-500">
              The gap between these two lines is the pricing margin the algorithm navigates. When demand bids exceed supply price, there is room to raise the listing price.
            </p>
            <div className="mt-4">
              <PriceSpreadChart data={priceSpreadData} />
            </div>
          </div>
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 2</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Demand side</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              The demand side estimates buyer willingness to pay by transforming regional VIC1 demand and price data into hourly proxy bids. VIC1 is the Victorian regional electricity market identifier in the NEM, so this is regional market data rather than local household transaction data.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="Demand quantity formula"
              formula={`Dₜ = (1 / nₜ) · Σᵢ TOTALDEMAND₍ₜ,ᵢ₎\nthen scale by 1 / 1000`}
              rationale="We average raw VIC1 demand within each hour and rescale it to a project-level demand quantity that is usable inside a household P2P trading scenario."
            />
            <FormulaCard
              title="Demand-side price proxy"
              formula={`Pₜ = clamp( Q₀.₉₀(RRPₜ⁺) / 1000 , 0.02 , 0.40 )`}
              rationale="Positive upper-quantile RRP is used as a willingness-to-pay proxy because the raw dataset does not contain real household bid prices."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="OLS demand model"
              formula={`log(Ďₜ) = β₀ + β₁pₜ + β₂hₜ(sin) + β₃hₜ(cos)\n          + β₄mₜ(sin) + β₅mₜ(cos)\n          + β₆lagDemand1ₜ + β₇lagDemand24ₜ + β₈lagPrice1ₜ + ⋯`}
              rationale="OLS is the main interpretable model in the coursework version. It shows how demand changes with price, cyclical time features, and historical lag structure."
            />
            <FormulaCard
              title="Random Forest extension"
              formula={`Ďₜ = f( pₜ, hourₜ, monthₜ, lagDemand1ₜ, lagDemand24ₜ,\n        lagDemand168ₜ, lagPrice1ₜ, rollingDemand24ₜ,\n        rollingDemand168ₜ, weatherₜ, … )`}
              rationale="Random Forest is used as a nonlinear comparison model. It helps capture interactions that the linear OLS structure cannot express as easily."
            />
          </div>

          <div className="rounded-[1.7rem] border border-stone-200/70 bg-white/80 p-5">
            <p className="text-sm leading-7 text-stone-700">
              Rationale: the raw dataset is not a true P2P buyer order book, so VoltShare turns the VIC1 regional series into a structured demand-side proxy. This lets the app learn hourly demand pressure even when transaction-level local bids are unavailable.
            </p>
          </div>

          <div className="rounded-[1.7rem] border border-amber-200/60 bg-[linear-gradient(150deg,rgba(255,254,249,0.98),rgba(253,247,233,0.90))] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Average demand by hour of day</p>
            <p className="mt-1 text-sm text-stone-500">Shows when buyer-side pressure peaks across the dataset — the model learns this pattern.</p>
            <div className="mt-4">
              <HourlyDemandPattern data={hourlyDemandData} />
            </div>
          </div>

          <SampleTable
            heading="Demand-side dataset preview"
            columns={['Buyer proxy', 'Demand', 'Max bid', 'Time']}
            rows={demandSample.map((bid) => [bid.buyerName, `${bid.demandKwh.toFixed(1)} kWh`, `${bid.maxPricePerKwh.toFixed(3)}/kWh`, formatDateTime(bid.requestedAt, compactDate)])}
            scrollHeight="max-h-[26rem]"
          />
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 3</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Supply side</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              The supply side approximates what a typical household could list by aggregating multi-site solar generation into hourly surplus reference quotes.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="Site-hour generation"
              formula={`G₍s,t₎ = Σⱼ max( SolarGeneration₍s,t,j₎ , 0 )`}
              rationale="Only positive solar generation is retained, then grouped into hourly site-level energy so the raw solar stream becomes marketplace-ready."
            />
            <FormulaCard
              title="Household surplus proxy"
              formula={`Sₜ = medianₛ( G₍s,t₎ ) / 4`}
              rationale="The hourly median across active sites is scaled down to approximate a typical household surplus rather than a utility-scale solar fleet."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="Supply-side price reference"
              formula={`Priceₜ = f( relative surplus abundanceₜ )`}
              rationale="The supply-side price reference is inversely mapped from hourly abundance: more surplus tends to imply a lower listing reference price, while tighter supply implies a higher one."
            />
            <FormulaCard
              title="Weather-aware supply adjustment"
              formula={`ΔSupplyₜ = clamp( (radiationₜ − 240)·0.0026 + (DNIₜ − 300)·0.0014\n                − cloudₜ·0.018 − rainₜ·0.55 + nightPenalty ,\n                −0.9Sₜ , 0.9Sₜ )`}
              rationale="Weather is added because solar availability is directly weather-sensitive. Radiation tends to lift available supply, while cloud, rain, and night-time conditions reduce it."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              title="Supply pricing intuition"
              body="When surplus is abundant, the suggested listing price is pushed lower. When supply tightens, the suggested price rises. This mimics how local market scarcity affects seller behavior."
            />
            <InfoCard
              title="Weather context"
              body={`Weather is aligned using ${defaultWeatherLocation.label}. It is conceptually useful for solar availability, but still limited because a single location cannot represent the full VIC1 regional market.`}
            />
          </div>

          <div className="rounded-[1.7rem] border border-emerald-200/60 bg-[linear-gradient(150deg,rgba(251,255,252,0.98),rgba(239,252,243,0.88))] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Supply records — surplus kWh vs listing price</p>
            <p className="mt-1 text-sm text-stone-500">
              Each dot is one hourly supply record. The cluster shape reveals the typical household surplus range and the price distribution the model learns from.
            </p>
            <div className="mt-4">
              <SupplyScatter data={supplyScatterData} />
            </div>
          </div>

          <SampleTable
            heading="Supply-side dataset preview"
            columns={['Reporter', 'Surplus', 'Price', 'Time']}
            rows={supplySample.map((report) => [report.reporterName, `${report.surplusKwh.toFixed(1)} kWh`, `${report.pricePerKwh.toFixed(3)}/kWh`, formatDateTime(report.reportedAt, compactDate)])}
            scrollHeight="max-h-[26rem]"
          />
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 4</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Optimal price generation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              VoltShare combines demand proxies, supply proxies, and model predictions to search for a listing price with stronger expected net revenue.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="Merged hourly modeling row"
              formula={`Xₜ = [ timeₜ, lagDemandₜ, lagPriceₜ,\n       rollingDemandₜ, rollingPriceₜ, supplyₜ, weatherₜ ]`}
              rationale="Each hourly scenario is converted into one joined feature row so the model can evaluate a candidate price using both market history and context."
            />
            <FormulaCard
              title="Optimization logic"
              formula={`p*ₜ = argmaxₚ { Revenue(p) − FiTCost(p) − ShortfallPenalty(p) }`}
              rationale="Rather than outputting one universal market price, VoltShare evaluates a grid of candidate listing prices and keeps the one with the strongest expected payoff."
            />
          </div>

          <form className="grid gap-4 rounded-[1.75rem] border border-stone-200/70 bg-white/80 p-5" onSubmit={handleOptimize}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="field-block">
                <span className="field-label">Listing hour</span>
                <input className="input-control" type="datetime-local" step="3600" value={listingTime} onChange={(event) => setListingTime(event.target.value)} />
              </label>
              <label className="field-block">
                <span className="field-label">Surplus kWh</span>
                <input className="input-control" type="number" min="0" step="0.1" value={mySurplusKwh} onChange={(event) => setMySurplusKwh(event.target.value)} />
              </label>
              <label className="field-block">
                <span className="field-label">Target price /kWh</span>
                <input className="input-control" type="number" min="0" step="0.001" value={myPrice} onChange={(event) => setMyPrice(event.target.value)} />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-500">
                {pricingError || 'This classroom demo searches over candidate prices and balances expected revenue against shortfall and FiT opportunity cost.'}
              </div>
              <button type="submit" className="primary-btn">
                <Sparkles className="h-4 w-4" />
                Generate optimal price
              </button>
            </div>
          </form>

          {recommendation ? (
            <div className="space-y-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">Optimal result</p>
                  <h3 className="mt-2 text-4xl font-semibold tracking-tight text-emerald-950">{recommendation.optimizedPrice.toFixed(3)}/kWh</h3>
                </div>
                <div className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900">
                  Expected net revenue {currency.format(recommendation.expectedRevenue)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ResultCard label="Current price revenue" value={currency.format(recommendation.currentRevenue)} note="Expected outcome at the input price" />
                <ResultCard label="Revenue change" value={`${recommendation.revenueDelta >= 0 ? '+' : ''}${currency.format(recommendation.revenueDelta)}`} note="Lift versus the original target price" />
                <ResultCard label="Expected demand" value={`${recommendation.demandCoverageKwh.toFixed(1)} kWh`} note={`Coverage ratio ${recommendation.demandCoverageRatio.toFixed(2)}x`} />
              </div>

              <div className="rounded-[1.4rem] border border-emerald-100 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Revenue across candidate prices</p>
                <p className="mt-1 text-sm text-stone-500">
                  The algorithm evaluated {recommendation.priceCurve.length} candidate prices. The curve shows how expected net revenue changes — the peak is the recommended price.
                </p>
                <div className="mt-4">
                  <RevenueCurve
                    priceCurve={recommendation.priceCurve}
                    inputPrice={Number(myPrice)}
                    optimalPrice={recommendation.optimizedPrice}
                    fitPrice={recommendation.fitPrice}
                    retailTariff={recommendation.retailTariff}
                  />
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-emerald-100 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">OLS vs Random Forest — model comparison</p>
                <p className="mt-1 text-sm text-stone-500">
                  Both models are trained on the same demand dataset. Lower RMSE and higher R² indicate better out-of-sample fit.
                </p>
                <div className="mt-5">
                  <ModelComparisonChart
                    olsRmse={recommendation.demandModelSummary.baseline.rmse}
                    rfRmse={recommendation.demandModelSummary.randomForest.rmse}
                    rfR2={recommendation.demandModelSummary.randomForest.r2}
                    trainCount={recommendation.demandModelSummary.trainCount}
                    testCount={recommendation.demandModelSummary.testCount}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <InfoCard
                  title="Model explanation"
                  body={recommendation.explanation.slice(0, 3).join(' ')}
                />
                <InfoCard
                  title="Weather and market context"
                  body={`Weather summary: ${recommendation.weatherSummary}. Demand adjustment ${recommendation.weatherAdjustedDemandMultiplier.toFixed(2)}x and supply adjustment ${recommendation.weatherAdjustedSupplyAdjustment.toFixed(2)} kWh.`}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/70 p-8 text-sm leading-7 text-stone-600">
              Enter a listing hour, surplus kWh, and a target price, then generate a recommendation to show how the pricing engine works.
            </div>
          )}
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 5</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Synthetic community users</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              Because the raw datasets do not contain real household identities, VoltShare uses generated user personas to simulate neighborhood participation and make the app feel like a local marketplace.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {syntheticUsers.map((user) => (
              <div key={user.name} className="rounded-[1.6rem] border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_rgba(109,84,35,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-stone-950">{user.name}</p>
                  <Users className="h-4 w-4 text-emerald-700" />
                </div>
                <p className="mt-2 text-sm font-medium text-emerald-800">{user.role}</p>
                <p className="mt-3 text-sm leading-6 text-stone-600">{user.note}</p>
                <div className="mt-4 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                  {user.postcode}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-7 text-amber-950">
            These users are synthetic and are only used to create a community-facing product story. They are not derived from real postcode-level household identity data.
          </div>
        </section>

        <section className="panel space-y-5">
          <div>
            <p className="eyebrow">Part 6</p>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Limitations</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              title="Proxy demand labels"
              body="The demand side is built from VIC1 regional market data, not true local P2P buyer orders."
            />
            <InfoCard
              title="Proxy supply labels"
              body="The supply side approximates household surplus from aggregated solar generation rather than real individual seller listings."
            />
            <InfoCard
              title="Weather granularity"
              body={`Weather uses ${defaultWeatherLocation.label} as a proxy. This is useful for a demo, but still too coarse for region-wide market behavior.`}
            />
            <InfoCard
              title="No real postcode matching"
              body="The current raw datasets do not contain postcode, meter, or feeder-level identity, so true neighbor eligibility is not yet validated."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  source,
}: {
  icon: typeof Leaf;
  label: string;
  value: string;
  note: string;
  source?: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_10px_32px_rgba(109,84,35,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">{label}</p>
        <Icon className="h-5 w-5 text-amber-700" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">{note}</p>
      {source ? (
        <div className="mt-3 rounded-[1rem] bg-stone-50/90 px-3 py-2 text-xs leading-5 text-stone-500">
          Source: <span className="font-medium text-stone-700 break-all">{source}</span>
        </div>
      ) : null}
    </div>
  );
}

function FormulaCard({
  title,
  formula,
  rationale,
}: {
  title: string;
  formula: string;
  rationale: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-amber-200/60 bg-[linear-gradient(150deg,rgba(255,254,249,0.98),rgba(253,247,233,0.90))] p-6 shadow-[0_6px_22px_rgba(109,84,35,0.08)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-stone-400">{title}</p>
      <div className="my-4 border-y border-stone-200/70 py-4">
        <pre
          className="whitespace-pre-wrap text-[1.13rem] leading-[2.05] text-stone-900"
          style={{ fontFamily: "'EB Garamond', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif", letterSpacing: '0.012em' }}
        >
          {formula}
        </pre>
      </div>
      <p className="text-sm leading-7 text-stone-500">{rationale}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.6rem] border border-stone-200/70 bg-white/85 p-5 shadow-[0_10px_28px_rgba(109,84,35,0.06)]">
      <p className="text-base font-semibold text-stone-950">{title}</p>
      <p className="mt-3 text-sm leading-7 text-stone-600">{body}</p>
    </div>
  );
}

function ResultCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-emerald-200/70 bg-white/80 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-2 text-sm text-stone-600">{note}</p>
    </div>
  );
}

function ModeCard({
  label,
  icon,
  heading,
  description,
  badge,
  badgeStyle,
}: {
  label: string;
  icon: string;
  heading: string;
  description: string;
  badge: string;
  badgeStyle: 'emerald' | 'amber';
}) {
  const badgeClass =
    badgeStyle === 'emerald'
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      : 'bg-amber-100 text-amber-800 border border-amber-200';

  return (
    <div className="rounded-[1.5rem] border border-stone-200/80 bg-white/85 p-4 shadow-[0_8px_24px_rgba(109,84,35,0.07)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">{label}</p>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-stone-950">{heading}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
      <div className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${badgeClass}`}>
        {badge}
      </div>
    </div>
  );
}

function SampleTable({
  heading,
  columns,
  rows,
  scrollHeight = 'max-h-[22rem]',
}: {
  heading: string;
  columns: string[];
  rows: string[][];
  scrollHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
      <div className="border-b border-stone-200/70 px-4 py-4">
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">{heading}</h3>
      </div>
      <div className={`grid gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className={`${scrollHeight} overflow-auto`}>
        {rows.map((row, index) => (
          <div
            key={`${heading}-${index}`}
            className="grid gap-3 border-b border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {row.map((cell, cellIndex) => (
              <span key={`${heading}-${index}-${cellIndex}`} className={cellIndex === 0 ? 'font-medium text-stone-950' : ''}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
