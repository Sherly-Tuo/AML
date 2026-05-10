import { ArrowRight, Coins, CreditCard, Leaf, MapPin, ShoppingBag, SunMedium, ThermometerSun, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackAppEvent } from '@/services/analytics';
import { supabase } from '@/lib/supabase';
import { fetchCurrentWeatherSnapshot } from '@/services/weatherService';
import { useStore } from '@/store';
import type { CurrentWeatherSnapshot } from '@/types';
import { useAuth } from '@/auth/AuthProvider';
import { getMarketStats } from '@/services/aiService';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isReasonableHouseholdSurplus(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

export default function MobileHome() {
  const { user, profile } = useAuth();
  const marketReports = useStore((state) => state.marketReports);
  const optimizationHistory = useStore((state) => state.optimizationHistory);
  const purchases = useStore((state) => state.purchases);
  const walletCredits = useStore((state) => state.walletCredits);
  const redeemPromoCode = useStore((state) => state.redeemPromoCode);

  const marketStats = getMarketStats(marketReports);
  const validOptimizationHistory = optimizationHistory.filter((run) => isReasonableHouseholdSurplus(run.surplusKwh));
  const latestRun = validOptimizationHistory[0] ?? null;
  const hasSetup = Boolean(latestRun);
  const walletProjection = validOptimizationHistory.reduce((sum, run) => sum + run.expectedRevenue, 0);
  const purchasedTotal = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
  const buyPreviewAveragePrice = useMemo(() => {
    const sourceLabels = ['Solar', 'Wind', 'Battery'] as const;

    const previewPrices = [...marketReports]
      .filter((report) => report.surplusKwh > 0.2)
      .sort((a, b) => b.surplusKwh - a.surplusKwh)
      .slice(0, 10)
      .map((report, index) => {
        const source = sourceLabels[index % sourceLabels.length];
        const distanceKm = 0.8 + index * 0.7;
        const sourcePremium = source === 'Battery' ? 0.012 : source === 'Wind' ? 0.006 : 0;
        const scarcityPremium = clamp((7 - Math.min(report.surplusKwh, 7)) * 0.0035, 0, 0.02);
        const distancePremium = distanceKm < 1.2 ? 0.004 : distanceKm < 2 ? 0.002 : 0;
        const sellerPremium = (index % 4) * 0.002;

        return clamp(
          Number((report.pricePerKwh + sourcePremium + scarcityPremium + distancePremium + sellerPremium).toFixed(3)),
          0.118,
          0.228,
        );
      });

    if (previewPrices.length === 0) {
      return marketStats.averagePrice;
    }

    return Number((previewPrices.reduce((sum, price) => sum + price, 0) / previewPrices.length).toFixed(3));
  }, [marketReports, marketStats.averagePrice]);
  const [weatherSnapshot, setWeatherSnapshot] = useState<CurrentWeatherSnapshot | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState('');
  const [topUpNoticeOpen, setTopUpNoticeOpen] = useState(false);
  const [remoteCredits, setRemoteCredits] = useState<number | null>(null);
  const [showEarningsExplain, setShowEarningsExplain] = useState(false);

  const effectiveWalletCredits = remoteCredits ?? walletCredits;
  const effectiveBalance = effectiveWalletCredits + walletProjection - purchasedTotal;

  useEffect(() => {
    let isMounted = true;

    const loadWeather = async () => {
      try {
        const snapshot = await fetchCurrentWeatherSnapshot();
        if (isMounted) {
          setWeatherSnapshot(snapshot);
        }
      } catch (error) {
        console.error('Failed to load current weather snapshot:', error);
      }
    };

    void loadWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setRemoteCredits(null);
      return;
    }

    const client = supabase;
    let isMounted = true;

    const loadCredits = async () => {
      const { data, error } = await client
        .from('wallet_credit_events')
        .select('amount')
        .eq('user_id', user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to load wallet credit events:', error.message);
        setRemoteCredits(null);
        return;
      }

      const creditTotal = (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      setRemoteCredits(Number(creditTotal.toFixed(2)));
    };

    void loadCredits();

    return () => {
      isMounted = false;
    };
  }, [user?.id, promoStatus]);

  useEffect(() => {
    void trackAppEvent({
      eventName: 'view_home_screen',
      screen: 'home',
      userId: user?.id ?? null,
      metadata: {
        hasSetup,
        walletCredits: Number(effectiveWalletCredits.toFixed(2)),
      },
    });
  }, [user?.id, hasSetup, effectiveWalletCredits]);

  const locationLabel = useMemo(() => {
    if (profile?.postcode) {
      return `Postcode ${profile.postcode}`;
    }

    return weatherSnapshot?.locationLabel ?? 'Melbourne, VIC';
  }, [profile?.postcode, weatherSnapshot?.locationLabel]);

  const sunlightHint = useMemo(() => {
    if (!weatherSnapshot?.sunriseTime || !weatherSnapshot?.sunsetTime) {
      return 'Daily solar window unavailable right now';
    }

    return `Sunlight roughly ${shortTime.format(new Date(weatherSnapshot.sunriseTime))} to ${shortTime.format(new Date(weatherSnapshot.sunsetTime))}`;
  }, [weatherSnapshot?.sunriseTime, weatherSnapshot?.sunsetTime]);

  const handleRedeemCode = async () => {
    const normalizedCode = promoCode.trim().toUpperCase();

    const result = redeemPromoCode(promoCode);
    setPromoStatus(result.message);

    if (result.success) {
      if (supabase && user) {
        const client = supabase;
        const { error } = await client.from('wallet_credit_events').insert({
          user_id: user.id,
          event_type: 'promo_code',
          amount: result.creditAdded ?? 0,
          promo_code: normalizedCode,
          notes: 'Promo credit redeemed from Home screen',
        });

        if (error) {
          console.error('Failed to save promo credit event to Supabase:', error.message);
        } else {
          setRemoteCredits((current) => Number(((current ?? effectiveWalletCredits) + (result.creditAdded ?? 0)).toFixed(2)));
        }
      }

      void trackAppEvent({
        eventName: 'redeem_promo_code',
        screen: 'home',
        userId: user?.id ?? null,
        metadata: {
          code: normalizedCode,
          creditAdded: result.creditAdded ?? 0,
        },
      });
      setPromoCode('');
    }
  };

  const handleApplePayTopUp = async () => {
    void trackAppEvent({
      eventName: 'click_top_up',
      screen: 'home',
      userId: user?.id ?? null,
      metadata: {
        method: 'top_up_info_only',
      },
    });
    setTopUpNoticeOpen((current) => !current);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-emerald-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(16,24,20,0.18)]">
        {!hasSetup ? (
          <div className="mb-4 flex justify-center">
            <div className="rounded-full border border-emerald-300/40 bg-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-100">
              Guest mode
            </div>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Today</p>
            <h2 className="mt-2 max-w-[15rem] text-3xl font-semibold tracking-tight">
              {hasSetup ? 'Your sell plan is ready' : 'Set up today’s surplus'}
            </h2>
            <p className="mt-2 max-w-[16rem] text-sm leading-6 text-emerald-100/80">
              {hasSetup
                ? 'VoltShare suggests a stronger sell price based on local supply, demand, and your latest run.'
                : 'Add your extra energy first, then get a suggested local sell price.'}
            </p>
          </div>
          <div data-onboarding-id="home-market-average" className="rounded-[1.5rem] bg-white/10 px-3 py-2 text-right">
            <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.15em] text-emerald-100/70">Market avg</div>
            <div className="mt-1 whitespace-nowrap text-base font-semibold">
              ${buyPreviewAveragePrice.toFixed(3)}/kWh
            </div>
          </div>
        </div>

        <div data-onboarding-id="home-add-surplus" className="mt-5 rounded-[1.6rem] bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                {hasSetup ? 'Available surplus' : 'Start here'}
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {hasSetup ? `${latestRun?.surplusKwh.toFixed(1) ?? '0.0'} kWh` : 'Add surplus'}
              </p>
            </div>
            <Link
              to="/app/sell"
              data-onboarding-id="home-sell-cta"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-emerald-950 shadow-[0_10px_24px_rgba(16,24,20,0.14)]"
            >
              {hasSetup ? 'Sell now' : 'Set up surplus'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {hasSetup && latestRun ? (
            <p className="mt-3 text-sm leading-6 text-emerald-50/85">
              Latest optimized run projected {currency.format(latestRun.expectedRevenue)} in expected earnings.
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricPill
            label={hasSetup ? 'Recommended price' : 'Nearby listings'}
            value={
              hasSetup
                ? `$${latestRun?.optimizedPrice.toFixed(3) ?? '0.000'}/kWh`
                : `${Math.min(marketReports.filter((report) => report.surplusKwh >= 1).length, 12)} sellers`
            }
            description={hasSetup ? 'Can stay above market avg when demand is stronger.' : undefined}
            icon={hasSetup ? TrendingUp : ShoppingBag}
          />
          <MetricPill
            label={hasSetup ? 'Potential earnings' : 'Avg local listing'}
            value={
              hasSetup
                ? currency.format(latestRun?.expectedRevenue ?? 0)
                : `$${buyPreviewAveragePrice.toFixed(3)}/kWh`
            }
            description={
              hasSetup
                ? '≈ surplus × projected demand − grid fee + FiT adj.'
                : undefined
            }
            icon={hasSetup ? Coins : TrendingUp}
            interactive={hasSetup}
            expanded={showEarningsExplain}
            onToggle={() => setShowEarningsExplain((current) => !current)}
            details={[
              'surplus amount',
              'local demand strength',
              'solar timing',
              'pricing optimization',
            ]}
          />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">My Information</p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Wallet balance</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">{currency.format(effectiveBalance)}</p>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Credits {currency.format(effectiveWalletCredits)} · Purchases {currency.format(purchasedTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplePayTopUp}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-900"
            >
              <CreditCard className="h-4 w-4" />
              Top Up
            </button>
          </div>

          {topUpNoticeOpen ? (
            <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
              Wallet top-up is not linked to a payment provider yet. Use the redeem code below instead.
            </div>
          ) : null}

          <div className="mt-4 rounded-[1.2rem] border border-stone-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value)}
                placeholder="Enter promo code"
              />
              <button
                type="button"
                onClick={() => void handleRedeemCode()}
                className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white"
              >
                Redeem
              </button>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-stone-500">Try AGRADEPROJECT for demo credit</p>
          </div>

          {promoStatus ? (
            <div className="mt-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
              {promoStatus}
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <div className="flex items-center gap-2 text-stone-500">
                <MapPin className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.18em]">Location</p>
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight text-stone-950">{locationLabel}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-stone-500">
                <ThermometerSun className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.18em]">LIVE WEATHER</p>
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight text-stone-950">
                {weatherSnapshot ? `${weatherSnapshot.temperatureC.toFixed(1)}°C` : '--'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-stone-500">
              <SunMedium className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Solar window</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-700">{sunlightHint}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricPill({
  label,
  value,
  description,
  icon: Icon,
  interactive = false,
  expanded = false,
  onToggle,
  details,
}: {
  label: string;
  value: string;
  description?: string;
  icon: typeof Leaf;
  interactive?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  details?: string[];
}) {
  return (
    <button
      type="button"
      onClick={interactive ? onToggle : undefined}
      className={`w-full rounded-[1.5rem] bg-white/10 px-4 py-3 text-left ${interactive ? 'transition hover:bg-white/12' : ''}`}
    >
      <div className="flex items-center gap-2 text-emerald-100/80">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {description ? <p className="mt-2 text-xs leading-5 text-emerald-50/75">{description}</p> : null}
      {interactive && expanded && details?.length ? (
        <div className="mt-3 rounded-[1rem] border border-white/15 bg-black/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/70">Estimated from</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-50/85">
            {details.map((detail) => (
              <li key={detail}>• {detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </button>
  );
}
