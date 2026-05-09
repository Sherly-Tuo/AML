import { LoaderCircle, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { defaultDemandDatasetMeta } from '@/data/vic1DemandBids';
import { parseDateTimeLocalToUtcIso } from '@/lib/datetime';
import { calculateOptimizedPricing } from '@/services/aiService';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import type { PricingRecommendation } from '@/types';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SellEnergy() {
  const { user, profile } = useAuth();
  const marketReports = useStore((state) => state.marketReports);
  const demandBids = useStore((state) => state.demandBids);
  const addMarketReport = useStore((state) => state.addMarketReport);
  const saveOptimizationRun = useStore((state) => state.saveOptimizationRun);

  const [surplusKwh, setSurplusKwh] = useState('5.5');
  const [targetPrice, setTargetPrice] = useState('0.18');
  const [listingTime, setListingTime] = useState(defaultDemandDatasetMeta.endDate.slice(0, 16));
  const [recommendation, setRecommendation] = useState<PricingRecommendation | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRecommend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const parsedSurplus = Number(surplusKwh);
    const parsedPrice = Number(targetPrice);
    const listingHourIso = parseDateTimeLocalToUtcIso(listingTime, '');

    if (!Number.isFinite(parsedSurplus) || parsedSurplus <= 0) {
      setError('Enter a valid surplus energy amount.');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Enter a valid target price.');
      return;
    }

    if (!listingHourIso) {
      setError('Choose a valid listing hour.');
      return;
    }

    setSubmitting(true);

    const result = calculateOptimizedPricing(
      {
        surplusKwh: parsedSurplus,
        targetPrice: parsedPrice,
        listingTime,
      },
      marketReports,
      demandBids,
      [],
    );

    setRecommendation(result);
    setSubmitting(false);
  };

  const handleConfirmListing = async () => {
    if (!recommendation) {
      return;
    }

    const parsedSurplus = Number(surplusKwh);
    const sellerName = profile?.display_name || user?.email || 'VoltShare household';
    const listingHourIso = parseDateTimeLocalToUtcIso(listingTime, new Date().toISOString()) ?? new Date().toISOString();

    // Save to local store
    addMarketReport({
      reporterName: sellerName,
      surplusKwh: parsedSurplus,
      pricePerKwh: recommendation.optimizedPrice,
      reportedAt: listingHourIso,
    });

    saveOptimizationRun({
      surplusKwh: parsedSurplus,
      inputPrice: Number(targetPrice),
      optimizedPrice: recommendation.optimizedPrice,
      expectedRevenue: recommendation.expectedRevenue,
    });

    // Also persist to Supabase if signed in
    if (supabase && user) {
      const { error } = await supabase.from('trades').insert({
        seller_id: user.id,
        surplus_kwh: parsedSurplus,
        price_per_kwh: recommendation.optimizedPrice,
        optimized_price: recommendation.optimizedPrice,
        expected_revenue: recommendation.expectedRevenue,
        listed_at: listingHourIso,
      });
      if (error) {
        console.error('Failed to save trade to Supabase:', error.message);
      }
    }

    setStatus(`Listing saved at ${recommendation.optimizedPrice.toFixed(3)}/kWh.`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Sell energy</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">List your surplus intelligently</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Enter your available energy and VoltShare will recommend a stronger asking price based on market demand and supply context.
        </p>
      </section>

      <form className="space-y-4 rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]" onSubmit={handleRecommend}>
        <label className="field-block">
          <span className="field-label">Surplus energy</span>
          <input className="input-control" value={surplusKwh} onChange={(event) => setSurplusKwh(event.target.value)} />
        </label>

        <label className="field-block">
          <span className="field-label">Your target price</span>
          <input className="input-control" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} />
        </label>

        <label className="field-block">
          <span className="field-label">Listing hour</span>
          <input
            className="input-control"
            type="datetime-local"
            value={listingTime}
            onChange={(event) => setListingTime(event.target.value)}
          />
        </label>

        {error ? <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
        {status ? <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</div> : null}

        <button className="primary-btn w-full" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitting ? 'Running model...' : 'Get recommendation'}
        </button>
      </form>

      {recommendation ? (
        <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">VoltShare recommendation</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
            {recommendation.optimizedPrice.toFixed(3)}/kWh
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{recommendation.weatherSummary || recommendation.explanation[0]}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <CardMetric label="Expected earnings" value={currency.format(recommendation.expectedRevenue)} />
            <CardMetric label="Revenue change" value={currency.format(recommendation.revenueDelta)} />
            <CardMetric label="Expected fill" value={recommendation.fillExpectation} />
            <CardMetric label="Comparable listings" value={`${recommendation.comparableCount}`} />
          </div>

          <button className="primary-btn mt-5 w-full" type="button" onClick={() => void handleConfirmListing()}>
            Confirm listing
          </button>
        </section>
      ) : null}
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] bg-stone-50/80 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-2 text-base font-semibold capitalize text-stone-950">{value}</div>
    </div>
  );
}
