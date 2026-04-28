import {
  BarChart3,
  CloudSun,
  Database,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import type { ChangeEvent, ComponentType, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { defaultDemandDatasetMeta } from '@/data/vic1DemandBids';
import { defaultSupplyDatasetMeta } from '@/data/solarSupplyReports';
import { parseDemandDataset } from '@/lib/demandImport';
import { calculateOptimizedPricing, getDemandStats, getMarketStats } from '@/services/aiService';
import {
  alignHistoricalWeatherWithMarket,
  defaultWeatherLocation,
  describeWeatherSignal,
  estimateListingPriceFromWeather,
  estimateSolarSurplusFromWeather,
  fetchHistoricalWeather,
  getHistoricalWeatherWindow,
} from '@/services/weatherService';
import { useStore } from '@/store';
import type { PricingRecommendation, WeatherHour } from '@/types';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const datetime = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatUnitPrice = (value: number) => value.toFixed(3);
const formatCoverageRatio = (value: number) => `${value.toFixed(2)}x`;
const formatListingTime = (value: string) => value.replace('T', ' ').slice(0, 16);
const formatWeatherHour = (value: string) => value.slice(5, 16).replace('T', ' ');
const toListingHourIso = (value: string) => new Date(`${value}:00Z`).toISOString();

function Home() {
  const marketReports = useStore((state) => state.marketReports);
  const demandBids = useStore((state) => state.demandBids);
  const optimizationHistory = useStore((state) => state.optimizationHistory);
  const addMarketReport = useStore((state) => state.addMarketReport);
  const removeMarketReport = useStore((state) => state.removeMarketReport);
  const resetMarketReports = useStore((state) => state.resetMarketReports);
  const importDemandBids = useStore((state) => state.importDemandBids);
  const removeDemandBid = useStore((state) => state.removeDemandBid);
  const resetDemandBids = useStore((state) => state.resetDemandBids);
  const saveOptimizationRun = useStore((state) => state.saveOptimizationRun);
  const clearOptimizationHistory = useStore((state) => state.clearOptimizationHistory);

  const [reporterName, setReporterName] = useState('');
  const [reportKwh, setReportKwh] = useState('');
  const [reportPrice, setReportPrice] = useState('');
  const [mySurplusKwh, setMySurplusKwh] = useState('');
  const [myPrice, setMyPrice] = useState('');
  const [listingTime, setListingTime] = useState(defaultDemandDatasetMeta.endDate.slice(0, 16));
  const [recommendation, setRecommendation] = useState<PricingRecommendation | null>(null);
  const [databaseError, setDatabaseError] = useState('');
  const [pricingError, setPricingError] = useState('');
  const [demandImportText, setDemandImportText] = useState('');
  const [demandImportStatus, setDemandImportStatus] = useState('');
  const [demandImportWarnings, setDemandImportWarnings] = useState('');
  const [demandImportError, setDemandImportError] = useState('');
  const [historicalWeatherHours, setHistoricalWeatherHours] = useState<WeatherHour[]>([]);
  const [selectedHistoricalTime, setSelectedHistoricalTime] = useState('');
  const [weatherStatus, setWeatherStatus] = useState('Aligning 2025 historical weather with supply and demand...');
  const [weatherError, setWeatherError] = useState('');

  const marketStats = getMarketStats(marketReports);
  const demandStats = getDemandStats(demandBids);
  const defaultDemandRange = `${defaultDemandDatasetMeta.startDate} to ${defaultDemandDatasetMeta.endDate}`;
  const defaultSupplyRange = `${defaultSupplyDatasetMeta.startDate} to ${defaultSupplyDatasetMeta.endDate}`;
  const displayedDemandBids = [...demandBids]
    .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime())
    .slice(0, 240);
  const displayedMarketReports = [...marketReports]
    .sort((left, right) => new Date(right.reportedAt).getTime() - new Date(left.reportedAt).getTime())
    .slice(0, 240);
  const historicalWindow = useMemo(() => getHistoricalWeatherWindow(marketReports, demandBids), [marketReports, demandBids]);
  const alignedHistoricalHours = useMemo(
    () => alignHistoricalWeatherWithMarket(historicalWeatherHours, marketReports, demandBids),
    [historicalWeatherHours, marketReports, demandBids],
  );
  const selectedHistoricalHour =
    alignedHistoricalHours.find((hour) => hour.time === selectedHistoricalTime) ?? alignedHistoricalHours[0] ?? null;
  const presentationHour = useMemo(
    () =>
      [...alignedHistoricalHours].sort((left, right) => {
        const leftScore = left.totalSupplyKwh + left.totalDemandKwh - left.weather.cloudCover * 0.02;
        const rightScore = right.totalSupplyKwh + right.totalDemandKwh - right.weather.cloudCover * 0.02;
        return rightScore - leftScore;
      })[0] ?? null,
    [alignedHistoricalHours],
  );

  const loadHistoricalWeather = async () => {
    if (!historicalWindow) {
      setHistoricalWeatherHours([]);
      setSelectedHistoricalTime('');
      setWeatherStatus('');
      setWeatherError('There is no overlapping historical time window between the current supply and demand data.');
      return;
    }

    setWeatherError('');
    setWeatherStatus('Aligning 2025 historical weather with supply and demand...');

    try {
      const history = await fetchHistoricalWeather(historicalWindow);
      setHistoricalWeatherHours(history);
      const aligned = alignHistoricalWeatherWithMarket(history, marketReports, demandBids);
      setSelectedHistoricalTime((current) =>
        current && aligned.some((hour) => hour.time === current) ? current : (aligned[0]?.time ?? ''),
      );
      setWeatherStatus(
        `Aligned ${defaultWeatherLocation.label} historical weather from ${historicalWindow.startDate.slice(0, 10)} to ${historicalWindow.endDate.slice(0, 10)}.`,
      );
    } catch (error) {
      setHistoricalWeatherHours([]);
      setWeatherError(error instanceof Error ? error.message : 'Failed to load weather data.');
      setWeatherStatus('');
    }
  };

  useEffect(() => {
    void loadHistoricalWeather();
  }, [historicalWindow?.startDate, historicalWindow?.endDate]);

  const handleResetDatabase = () => {
    resetMarketReports();
    setRecommendation(null);
    setDatabaseError('');
  };

  const handleResetDemandData = () => {
    resetDemandBids();
    setRecommendation(null);
    setDemandImportText('');
    setDemandImportError('');
    setDemandImportWarnings('');
    setDemandImportStatus(`Restored the default ${defaultDemandDatasetMeta.region} demand-side dataset.`);
  };

  const handleAddReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedKwh = Number(reportKwh);
    const parsedPrice = Number(reportPrice);

    if (!reporterName.trim()) {
      setDatabaseError('Please enter a reporter name.');
      return;
    }

    if (!Number.isFinite(parsedKwh) || parsedKwh <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setDatabaseError('Energy and price must both be positive numbers.');
      return;
    }

    addMarketReport({
      reporterName,
      surplusKwh: parsedKwh,
      pricePerKwh: parsedPrice,
    });

    setReporterName('');
    setReportKwh('');
    setReportPrice('');
    setDatabaseError('');
  };

  const handleDemandFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();
    setDemandImportText(content);
    setDemandImportStatus(`Loaded file ${file.name}. It is ready to import.`);
    setDemandImportWarnings('');
    setDemandImportError('');
    event.target.value = '';
  };

  const handleImportDemand = (mode: 'append' | 'replace') => {
    const result = parseDemandDataset(demandImportText);

    if (result.rows.length === 0) {
      setDemandImportError(result.errors[0] ?? 'No demand-side records could be imported.');
      setDemandImportWarnings('');
      setDemandImportStatus('');
      return;
    }

    importDemandBids(result.rows, mode);
    setRecommendation(null);
    setDemandImportError('');
    setDemandImportWarnings(result.errors.slice(0, 2).join(' '));
    setDemandImportStatus(
      `${mode === 'replace' ? 'Replaced and imported' : 'Appended and imported'} ${result.rows.length} demand-side records (${result.format.toUpperCase()}).`,
    );
  };

  const handleOptimize = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedKwh = Number(mySurplusKwh);
    const parsedPrice = Number(myPrice);

    if (!Number.isFinite(parsedKwh) || parsedKwh <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPricingError('Please enter a valid surplus energy value and target selling price.');
      return;
    }

    const listingHourIso = toListingHourIso(listingTime);
    const matchedWeatherContext =
      selectedHistoricalHour?.time === listingHourIso
        ? selectedHistoricalHour.weather
        : alignedHistoricalHours.find((hour) => hour.time === listingHourIso)?.weather;

    const result = calculateOptimizedPricing(
      {
        surplusKwh: parsedKwh,
        targetPrice: parsedPrice,
        listingTime,
        weatherContext: matchedWeatherContext,
      },
      marketReports,
      demandBids,
      historicalWeatherHours,
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

  const handleApplyHistoricalHourToListing = () => {
    if (!selectedHistoricalHour) {
      return;
    }

    const observedSupply =
      selectedHistoricalHour.supplyReports.length > 0
        ? selectedHistoricalHour.totalSupplyKwh / selectedHistoricalHour.supplyReports.length
        : estimateSolarSurplusFromWeather(selectedHistoricalHour.weather);

    setListingTime(selectedHistoricalHour.time.slice(0, 16));
    setMySurplusKwh(observedSupply.toFixed(2));
    setMyPrice(
      (selectedHistoricalHour.averageSupplyPrice || estimateListingPriceFromWeather(selectedHistoricalHour.weather)).toFixed(3),
    );
    setPricingError('');
    setRecommendation(null);
  };

  const handleLoadPresentationScenario = () => {
    const demoHour = presentationHour ?? selectedHistoricalHour;

    if (!demoHour) {
      return;
    }

    setSelectedHistoricalTime(demoHour.time);
    const observedSupply =
      demoHour.supplyReports.length > 0
        ? demoHour.totalSupplyKwh / demoHour.supplyReports.length
        : estimateSolarSurplusFromWeather(demoHour.weather);

    setListingTime(demoHour.time.slice(0, 16));
    setMySurplusKwh(observedSupply.toFixed(2));
    setMyPrice((demoHour.averageSupplyPrice || estimateListingPriceFromWeather(demoHour.weather)).toFixed(3));
    setRecommendation(null);
    setPricingError('');
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="hero-panel">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <span className="chip">AML classroom demo</span>
                <span className="chip">Demand-side bids</span>
                <span className="chip">Supply-side quotes</span>
                <span className="chip">Optimized pricing</span>
              </div>
              <div className="space-y-3">
                <p className="eyebrow">VoltShare Pricing Tool</p>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                  Use demand, solar supply, and weather together to optimize a household solar listing price.
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-700 sm:text-lg">
                  This classroom demo loads hourly solar supply and VIC1 demand time series by default. It aligns them with
                  historical weather, then uses demand modeling and price search to recommend a stronger listing price.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="primary-btn" onClick={handleLoadPresentationScenario}>
                  <Sparkles className="h-4 w-4" />
                  Load Demo Scenario
                </button>
              </div>
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-950">
                Default demand data comes from {defaultDemandDatasetMeta.sourceFile}, default supply data comes from{' '}
                {defaultSupplyDatasetMeta.sourceFile}, and both are aggregated to the hourly level.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                icon={Database}
                label="Supply Records"
                value={`${marketStats.reportCount}`}
                note="Hourly solar supply records currently loaded"
              />
              <MetricCard
                icon={BarChart3}
                label="Demand Records"
                value={`${demandStats.bidCount}`}
                note="Buyer-side bids currently loaded"
              />
              <MetricCard
                icon={TrendingUp}
                label="Avg Supply Price"
                value={`${formatUnitPrice(marketStats.averagePrice)}/kWh`}
                note="Supply-weighted market price"
              />
              <MetricCard
                icon={Wallet}
                label="Avg Demand Bid"
                value={`${formatUnitPrice(demandStats.averageBid)}/kWh`}
                note="Demand-weighted willingness to pay"
              />
            </div>
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Project Overview</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">The Story, Datasets, and AML Logic In One View</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                This dashboard frames the project as a pricing assistant for peer-to-peer solar trading, built on historical
                demand data, hourly solar supply, and aligned historical weather.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950">
              Hook: The same 5 kWh of solar surplus can have very different value depending on the hour, the market, and the weather.
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ShowcaseCard
              title="Story"
              value="Smarter P2P solar pricing"
              note="Help household solar users decide when to sell, how much to sell, and at what price."
            />
            <ShowcaseCard
              title="Datasets"
              value="Demand + Supply + Weather"
              note="VIC1 demand, aggregated solar generation supply, and Open-Meteo historical weather in 2025."
            />
            <ShowcaseCard
              title="AML"
              value="Feature engineering + model comparison"
              note="Time features, weather features, OLS baseline, Random Forest, and grid search."
            />
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Historical Replay</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Align 2025 Historical Weather With Supply And Demand</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                This section pulls hourly weather from the Open-Meteo Historical Weather API for {defaultWeatherLocation.label}
                and aligns it with your supply and demand timestamps, so each historical hour can be explained in context.
              </p>
            </div>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void loadHistoricalWeather()}
            >
              <RefreshCcw className="h-4 w-4" />
              Reload Historical Weather
            </button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.84))] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-sky-700">Open-Meteo</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                      {selectedHistoricalHour ? formatWeatherHour(selectedHistoricalHour.time) : 'Waiting For Historical Alignment'}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                      {selectedHistoricalHour
                        ? describeWeatherSignal(selectedHistoricalHour.weather)
                        : weatherStatus || 'Loading historical weather data.'}
                    </p>
                  </div>
                  {weatherStatus && !selectedHistoricalHour ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm text-sky-800">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {weatherStatus}
                    </div>
                  ) : null}
                </div>

                {weatherError ? <p className="mt-4 text-sm text-red-700">{weatherError}</p> : null}

                {selectedHistoricalHour ? (
                  <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <ResultCard
                        label="Temperature"
                        value={`${selectedHistoricalHour.weather.temperatureC.toFixed(1)}°C`}
                        note={`Humidity ${selectedHistoricalHour.weather.relativeHumidity.toFixed(0)}%`}
                      />
                      <ResultCard
                        label="Historical Supply"
                        value={`${selectedHistoricalHour.totalSupplyKwh.toFixed(2)} kWh`}
                        note={`${selectedHistoricalHour.supplyReports.length} supply records`}
                      />
                      <ResultCard
                        label="Historical Demand"
                        value={`${selectedHistoricalHour.totalDemandKwh.toFixed(2)} kWh`}
                        note={`${selectedHistoricalHour.demandBids.length} demand records`}
                      />
                      <ResultCard
                        label="Demand-Supply Spread"
                        value={`${formatUnitPrice(selectedHistoricalHour.weightedDemandBid - selectedHistoricalHour.averageSupplyPrice)}/kWh`}
                        note={`supply ${formatUnitPrice(selectedHistoricalHour.averageSupplyPrice)} / demand ${formatUnitPrice(selectedHistoricalHour.weightedDemandBid)}`}
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <ResultCard
                        label="Solar Radiation"
                        value={`${selectedHistoricalHour.weather.shortwaveRadiation.toFixed(0)} W/m²`}
                        note={`DNI ${selectedHistoricalHour.weather.directNormalIrradiance.toFixed(0)} W/m²`}
                      />
                      <ResultCard
                        label="Weather-Implied Household Supply"
                        value={`${estimateSolarSurplusFromWeather(selectedHistoricalHour.weather).toFixed(2)} kWh`}
                        note={`Cloud cover ${selectedHistoricalHour.weather.cloudCover.toFixed(0)}%, precipitation ${selectedHistoricalHour.weather.precipitationMm.toFixed(1)} mm`}
                      />
                    </div>

                    <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-sm leading-7 text-stone-600">
                        You can send this historical hour directly into Step 2 and use it as a replay-based pricing demo.
                      </p>
                      <button type="button" className="secondary-btn" onClick={handleApplyHistoricalHourToListing}>
                        <CloudSun className="h-4 w-4" />
                        Use This Hour In Step 2
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
              <div className="grid grid-cols-[1fr_0.75fr_0.8fr_0.9fr] gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                <span>Hour</span>
                <span>Weather</span>
                <span>Supply</span>
                <span>Demand</span>
              </div>
              <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
                {weatherStatus ||
                  (historicalWindow
                    ? `Aligned window: ${historicalWindow.startDate.slice(0, 10)} to ${historicalWindow.endDate.slice(0, 10)}`
                    : 'Aligned historical hours appear here.')}
              </div>
              <div className="max-h-[32rem] overflow-auto">
                {alignedHistoricalHours.length > 0 ? (
                  alignedHistoricalHours.slice(0, 240).map((hour) => {
                    const active = hour.time === selectedHistoricalHour?.time;

                    return (
                      <button
                        key={hour.time}
                        type="button"
                        className={`grid w-full grid-cols-[1fr_0.75fr_0.8fr_0.9fr] gap-3 border-b border-stone-100 px-4 py-3 text-left text-sm transition last:border-b-0 ${
                          active ? 'bg-sky-50 text-stone-950' : 'text-stone-700 hover:bg-stone-50/80'
                        }`}
                        onClick={() => setSelectedHistoricalTime(hour.time)}
                      >
                        <span className="font-medium">{formatWeatherHour(hour.time)}</span>
                        <span>{hour.weather.temperatureC.toFixed(1)}°C / {hour.weather.cloudCover.toFixed(0)}%</span>
                        <span>{hour.totalSupplyKwh.toFixed(1)} kWh</span>
                        <span>{hour.totalDemandKwh.toFixed(1)} kWh</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-sm leading-7 text-stone-600">
                    Historical weather has not been aligned yet. If network access is available, the page will request the
                    matching 2025 archive window from Open-Meteo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Demand Side</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Import Your Demand-Side Data</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                You can paste or load CSV, TSV, or JSON. The parser recognizes `buyerName`, `demandKwh`, and
                `maxPricePerKwh`, plus common aliases such as `buyer`, `name`, `demand`, `kwh`, `bidPrice`, and `maxPrice`.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                The page starts with an hourly aggregated {defaultDemandDatasetMeta.region} demand dataset:
                {` ${defaultDemandDatasetMeta.aggregatedBidCount} records from ${defaultDemandRange}.`}
              </p>
            </div>
            <button type="button" className="secondary-btn" onClick={handleResetDemandData}>
              <RefreshCcw className="h-4 w-4" />
              Restore Default VIC1 Demand Data
            </button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-stone-200/70 bg-white/80 p-5">
                <p className="text-sm leading-7 text-stone-700">
                  The default demand-side library is aggregated from the VIC1 raw CSV you provided. `TOTALDEMAND / 1000`
                  becomes the normalized demand scale, and the positive hourly upper-quantile `RRP` becomes the buyer-side
                  willingness to pay in `/kWh`.
                </p>
                <textarea
                  className="mt-4 min-h-[260px] w-full rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4 text-sm leading-7 text-stone-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  value={demandImportText}
                  onChange={(event) => setDemandImportText(event.target.value)}
                  placeholder={`buyerName,demandKwh,maxPricePerKwh,requestedAt\nCampus Hub,2.8,0.206,2026-04-26T08:20:00Z\nEV Bay 4,1.9,0.198,2026-04-26T08:55:00Z`}
                />

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <label className="secondary-btn cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Load File
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.json"
                      className="hidden"
                      onChange={handleDemandFileChange}
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="secondary-btn" onClick={() => handleImportDemand('replace')}>
                      Replace Demand Data
                    </button>
                    <button type="button" className="primary-btn" onClick={() => handleImportDemand('append')}>
                      <Upload className="h-4 w-4" />
                      Append Import
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm leading-6">
                  <p className={demandImportError ? 'text-red-700' : 'text-stone-600'}>
                    {demandImportError || demandImportStatus || 'If you already have a demand dataset, paste it here and click “Append Import”.'}
                  </p>
                  {demandImportWarnings ? <p className="text-amber-800">{demandImportWarnings}</p> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ResultCard label="Total Demand" value={`${demandStats.totalDemandKwh.toFixed(1)} kWh`} note="Total demand currently in the library" />
                <ResultCard label="Weighted Bid" value={`${formatUnitPrice(demandStats.averageBid)}/kWh`} note="Demand-weighted willingness to pay" />
                <ResultCard label="Lowest Bid" value={`${formatUnitPrice(demandStats.lowestBid)}/kWh`} note="Minimum buyer-side bid price" />
                <ResultCard label="Highest Bid" value={`${formatUnitPrice(demandStats.highestBid)}/kWh`} note="Maximum buyer-side bid price" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
              <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_64px] gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                <span>Buyer</span>
                <span>Demand</span>
                <span>Max Bid</span>
                <span>Time</span>
                <span>Delete</span>
              </div>
              <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
                {`There are currently ${demandBids.length} demand records. This view shows the most recent 240.`}
              </div>
              <div className="max-h-[35rem] overflow-auto">
                {demandBids.length > 0 ? (
                  displayedDemandBids.map((bid) => (
                    <div
                      key={bid.id}
                      className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_64px] gap-3 border-b border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-b-0"
                    >
                      <span className="font-medium text-stone-950">{bid.buyerName}</span>
                      <span>{bid.demandKwh.toFixed(1)} kWh</span>
                      <span>{formatUnitPrice(bid.maxPricePerKwh)}/kWh</span>
                      <span>{datetime.format(new Date(bid.requestedAt))}</span>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-red-200 hover:text-red-600"
                        onClick={() => removeDemandBid(bid.id)}
                        aria-label={`Delete ${bid.buyerName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-sm leading-7 text-stone-600">
                    Imported demand-side records appear here. If there is no demand data, the pricing logic can only rely on supply-side signals.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="panel space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Review And Extend The Supply-Side Hourly Library</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                  The default supply-side dataset is an hourly aggregated solar generation time series. Any manually added
                  records are aligned to the hour so they can enter the same pricing workflow.
                </p>
              </div>
              <button type="button" className="secondary-btn" onClick={handleResetDatabase}>
                <RefreshCcw className="h-4 w-4" />
                Restore Default Solar Supply Data
              </button>
            </div>

            <div className="rounded-[1.75rem] border border-stone-200/70 bg-white/80 p-5 text-sm leading-7 text-stone-700">
              The default supply-side library comes from {defaultSupplyDatasetMeta.sourceFile}. After hourly aggregation, it
              contains {defaultSupplyDatasetMeta.aggregatedReportCount} records covering {defaultSupplyRange}. Quarter-hour
              `SolarGeneration` values are first aggregated to site-hour values, then scaled into a representative household surplus.
            </div>

            <form className="grid gap-4 rounded-[1.75rem] border border-stone-200/70 bg-white/80 p-5" onSubmit={handleAddReport}>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="field-block">
                  <span className="field-label">Reporter</span>
                  <input
                    className="input-control"
                    value={reporterName}
                    onChange={(event) => setReporterName(event.target.value)}
                    placeholder="e.g. Maple Home 8"
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Surplus Energy kWh</span>
                  <input
                    className="input-control"
                    type="number"
                    min="0"
                    step="0.1"
                    value={reportKwh}
                    onChange={(event) => setReportKwh(event.target.value)}
                    placeholder="4.5"
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Listing Price /kWh</span>
                  <input
                    className="input-control"
                    type="number"
                    min="0"
                    step="0.001"
                    value={reportPrice}
                    onChange={(event) => setReportPrice(event.target.value)}
                    placeholder="0.168"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-stone-500">
                  {databaseError || 'You can continue appending supply-side quotes here. They are stored in local browser storage.'}
                </div>
                <button type="submit" className="primary-btn">
                  <Upload className="h-4 w-4" />
                  Add To Supply Library
                </button>
              </div>
            </form>

            <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1fr_64px] gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                <span>Reporter</span>
                <span>Energy</span>
                <span>Price</span>
                <span>Time</span>
                <span>Delete</span>
              </div>
              <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
                {`There are currently ${marketReports.length} supply records. This view shows the most recent 240.`}
              </div>
              <div className="max-h-[32rem] overflow-auto">
                {displayedMarketReports.map((report) => (
                  <div
                    key={report.id}
                    className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1fr_64px] gap-3 border-b border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-b-0"
                  >
                    <span className="font-medium text-stone-950">{report.reporterName}</span>
                    <span>{report.surplusKwh.toFixed(1)} kWh</span>
                    <span>{formatUnitPrice(report.pricePerKwh)}/kWh</span>
                    <span>{datetime.format(new Date(report.reportedAt))}</span>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-red-200 hover:text-red-600"
                      onClick={() => removeMarketReport(report.id)}
                      aria-label={`Delete ${report.reporterName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel space-y-5">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Optimize A Household Listing Price</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                Enter a listing hour, expected surplus energy, and a target price. The system uses historical demand, supply,
                and weather signals to search for a price with stronger expected net revenue.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-900">
                The core message is simple: the user enters a listing hour, surplus kWh, and a target price, and the system
                returns an optimized recommendation.
              </p>
            </div>

            <form className="grid gap-4 rounded-[1.75rem] border border-stone-200/70 bg-white/80 p-5" onSubmit={handleOptimize}>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="field-block">
                  <span className="field-label">Listing Hour</span>
                  <input
                    className="input-control"
                    type="datetime-local"
                    step="3600"
                    value={listingTime}
                    onChange={(event) => setListingTime(event.target.value)}
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">My Surplus kWh</span>
                  <input
                    className="input-control"
                    type="number"
                    min="0"
                    step="0.1"
                    value={mySurplusKwh}
                    onChange={(event) => setMySurplusKwh(event.target.value)}
                    placeholder="4.2"
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">My Target Price /kWh</span>
                  <input
                    className="input-control"
                    type="number"
                    min="0"
                    step="0.001"
                    value={myPrice}
                    onChange={(event) => setMyPrice(event.target.value)}
                    placeholder="0.175"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-stone-500">
                  {pricingError || 'The model uses that hour to estimate demand and includes both FiT opportunity cost and shortfall risk.'}
                </div>
                <button type="submit" className="primary-btn">
                  <Sparkles className="h-4 w-4" />
                  Generate Optimized Price
                </button>
              </div>
            </form>

            {recommendation ? (
              <div className="space-y-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">Optimized Result</p>
                    <h3 className="mt-2 text-4xl font-semibold tracking-tight text-emerald-950">
                      {formatUnitPrice(recommendation.optimizedPrice)}/kWh
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="chip border-emerald-300 bg-white text-emerald-900">
                      {labelForCompetitiveness(recommendation.competitiveness)}
                    </span>
                    <span className="chip border-emerald-300 bg-white text-emerald-900">
                      Expected fill: {labelForFill(recommendation.fillExpectation)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ResultCard
                    label="Expected Net Revenue"
                    value={currency.format(recommendation.expectedRevenue)}
                    note="After FiT opportunity cost and shortfall penalty"
                  />
                  <ResultCard
                    label="Current Price Revenue"
                    value={currency.format(recommendation.currentRevenue)}
                    note="Estimated result at the input price"
                  />
                  <ResultCard
                    label="Revenue Change"
                    value={`${recommendation.revenueDelta >= 0 ? '+' : ''}${currency.format(recommendation.revenueDelta)}`}
                    note="Compared with the current target price"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-emerald-200/70 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Model And Market Context</p>
                    <div className="mt-3 grid gap-2 text-sm text-stone-700">
                      <p>Listing hour: {formatListingTime(recommendation.listingTime)}</p>
                      <p>Supply weighted average: {formatUnitPrice(recommendation.marketAveragePrice)}/kWh</p>
                      <p>Demand weighted bid: {formatUnitPrice(recommendation.demandWeightedBid)}/kWh</p>
                      <p>FiT opportunity cost: {formatUnitPrice(recommendation.fitPrice)}/kWh</p>
                      <p>Shortfall replacement cost: {formatUnitPrice(recommendation.retailTariff)}/kWh</p>
                      <p>Weather signal: {recommendation.weatherSummary}</p>
                      <p>Weather demand adjustment: {recommendation.weatherAdjustedDemandMultiplier.toFixed(2)}x</p>
                      <p>
                        Weather supply adjustment: {recommendation.weatherAdjustedSupplyAdjustment >= 0 ? '+' : ''}
                        {recommendation.weatherAdjustedSupplyAdjustment.toFixed(2)} kWh
                      </p>
                      <p>
                        Expected demand at optimized price: {recommendation.demandCoverageKwh.toFixed(1)} kWh (
                        {formatCoverageRatio(recommendation.demandCoverageRatio)})
                      </p>
                      <p>Expected shortfall at optimized price: {recommendation.expectedShortfallKwh.toFixed(2)} kWh</p>
                      <p>OLS test RMSE: {recommendation.demandModelSummary.baseline.rmse.toFixed(3)}</p>
                      <p>RF test RMSE: {recommendation.demandModelSummary.randomForest.rmse.toFixed(3)}</p>
                      <p>RF test R2: {recommendation.demandModelSummary.randomForest.r2.toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-emerald-200/70 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Algorithm Explanation</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                      {recommendation.explanation.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/70 p-8 text-sm leading-7 text-stone-600">
                Enter a listing hour, surplus kWh, and a target price, then click “Generate Optimized Price”. The result will
                show the recommended price, expected demand, and the weather-adjusted market context.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="panel space-y-5">
            <div>
              <p className="eyebrow">Supply References</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Which Supply Quotes Informed The Pricing Decision</h2>
            </div>

            {recommendation && recommendation.matchedReports.length > 0 ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.9fr_1fr] gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                  <span>Reporter</span>
                  <span>Energy</span>
                  <span>Price</span>
                  <span>Time</span>
                </div>
                {recommendation.matchedReports.map((report) => (
                  <div
                    key={report.id}
                    className="grid grid-cols-[1.3fr_0.8fr_0.9fr_1fr] gap-3 border-b border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-b-0"
                  >
                    <span className="font-medium text-stone-950">{report.reporterName}</span>
                    <span>{report.surplusKwh.toFixed(1)} kWh</span>
                    <span>{formatUnitPrice(report.pricePerKwh)}/kWh</span>
                    <span>{datetime.format(new Date(report.reportedAt))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/70 p-8 text-sm text-stone-600">
                After generating an optimized price, this panel shows the most comparable historical supply-side quotes used as references.
              </div>
            )}
          </div>

          <div className="panel space-y-5">
            <div>
              <p className="eyebrow">Demand References</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Which Demand Bids Were Used In This Pricing Run</h2>
            </div>

            {recommendation && recommendation.matchedDemandBids.length > 0 ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white/80">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1fr] gap-3 border-b border-stone-200/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                  <span>Buyer</span>
                  <span>Demand</span>
                  <span>Max Bid</span>
                  <span>Time</span>
                </div>
                {recommendation.matchedDemandBids.map((bid) => (
                  <div
                    key={bid.id}
                    className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1fr] gap-3 border-b border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-b-0"
                  >
                    <span className="font-medium text-stone-950">{bid.buyerName}</span>
                    <span>{bid.demandKwh.toFixed(1)} kWh</span>
                    <span>{formatUnitPrice(bid.maxPricePerKwh)}/kWh</span>
                    <span>{datetime.format(new Date(bid.requestedAt))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/70 p-8 text-sm text-stone-600">
                After demand-side data is loaded and an optimized price is generated, this panel shows the buyer bids used to estimate the clearing price context.
              </div>
            )}
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">History</p>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Recent Pricing Optimization Runs</h2>
            </div>
            <button type="button" className="secondary-btn" onClick={() => clearOptimizationHistory()}>
              <Trash2 className="h-4 w-4" />
              Clear History
            </button>
          </div>

          {optimizationHistory.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {optimizationHistory.map((run) => (
                <article key={run.id} className="rounded-[1.5rem] border border-stone-200/70 bg-white/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-stone-950">{run.surplusKwh.toFixed(1)} kWh</p>
                      <p className="text-sm text-stone-600">{datetime.format(new Date(run.createdAt))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-stone-500">Original price {formatUnitPrice(run.inputPrice)}/kWh</p>
                      <p className="text-lg font-semibold text-emerald-800">Recommended price {formatUnitPrice(run.optimizedPrice)}/kWh</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-stone-700">Expected net revenue {currency.format(run.expectedRevenue)}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/70 p-8 text-sm text-stone-600">
              Each time you generate an optimized price, a record appears here so you can compare different demand, supply, and pricing scenarios.
            </div>
          )}
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
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_10px_32px_rgba(109,84,35,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">{label}</p>
        <Icon className="h-5 w-5 text-amber-700" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{note}</p>
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

function ShowcaseCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.92),rgba(255,247,231,0.82))] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">{note}</p>
    </div>
  );
}

function labelForCompetitiveness(value: PricingRecommendation['competitiveness']) {
  if (value === 'aggressive') {
    return 'More Competitive';
  }

  if (value === 'premium') {
    return 'Premium Price';
  }

  return 'Near Market Midpoint';
}

function labelForFill(value: PricingRecommendation['fillExpectation']) {
  if (value === 'fast') {
    return 'Fast';
  }

  if (value === 'slow') {
    return 'Slow';
  }

  return 'Moderate';
}

export default Home;
