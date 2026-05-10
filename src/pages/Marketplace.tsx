import { BatteryCharging, CheckCircle2, MapPin, Sun, Wind, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { trackAppEvent } from '@/services/analytics';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';

const sourceIcons = [Sun, Wind, BatteryCharging] as const;
const sourceLabels = ['Solar', 'Wind', 'Battery'] as const;

type Listing = {
  id: string;
  neighborhood: string;
  source: (typeof sourceLabels)[number];
  distanceKm: string;
  trust: string;
  surplusKwh: number;
  pricePerKwh: number;
  displayPricePerKwh: number;
  sellerUserId?: string | null;
  postcode?: string | null;
  suburb?: string | null;
  isRemote?: boolean;
  Icon: (typeof sourceIcons)[number];
};

type RemoteListingRow = {
  id: string;
  user_id: string;
  title: string | null;
  source_type: string;
  postcode: string | null;
  suburb: string | null;
  surplus_kwh: number;
  listed_price_per_kwh: number;
  status: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function Marketplace() {
  const { user } = useAuth();
  const marketReports = useStore((s) => s.marketReports);
  const optimizationHistory = useStore((s) => s.optimizationHistory);
  const purchases = useStore((s) => s.purchases);
  const walletCredits = useStore((s) => s.walletCredits);
  const addPurchase = useStore((s) => s.addPurchase);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [remoteListings, setRemoteListings] = useState<Listing[]>([]);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteCredits, setRemoteCredits] = useState<number | null>(null);

  const walletProjection = optimizationHistory.reduce((sum, run) => sum + run.expectedRevenue, 0);
  const purchasedTotal = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
  const effectiveWalletCredits = remoteCredits ?? walletCredits;
  const effectiveBalance = Number((effectiveWalletCredits + walletProjection - purchasedTotal).toFixed(2));

  const fallbackListings = useMemo<Listing[]>(
    () =>
      [...marketReports]
        .filter((r) => r.surplusKwh > 0.2)
        .sort((a, b) => b.surplusKwh - a.surplusKwh)
        .slice(0, 10)
        .map((r, i) => {
          const source = sourceLabels[i % sourceLabels.length];
          const distanceKm = (0.8 + i * 0.7).toFixed(1);
          const sourcePremium = source === 'Battery' ? 0.012 : source === 'Wind' ? 0.006 : 0;
          const scarcityPremium = clamp((7 - Math.min(r.surplusKwh, 7)) * 0.0035, 0, 0.02);
          const distancePremium = Number(distanceKm) < 1.2 ? 0.004 : Number(distanceKm) < 2 ? 0.002 : 0;
          const sellerPremium = (i % 4) * 0.002;
          const displayPricePerKwh = clamp(
            Number((r.pricePerKwh + sourcePremium + scarcityPremium + distancePremium + sellerPremium).toFixed(3)),
            0.118,
            0.228,
          );

          return {
            ...r,
            source,
            distanceKm,
            displayPricePerKwh,
            neighborhood: ['Northcote', 'Brunswick', 'Carlton', 'Footscray', 'Fitzroy'][i % 5],
            trust: ['Verified meter', 'Green household', 'Fast responder'][i % 3],
            Icon: sourceIcons[i % sourceIcons.length],
          };
        }),
    [marketReports],
  );

  useEffect(() => {
    let isMounted = true;

    const loadRemoteListings = async () => {
      if (!supabase) {
        if (isMounted) {
          setRemoteLoaded(true);
        }
        return;
      }

      const { data, error } = await supabase
        .from('listings')
        .select('id, user_id, title, source_type, postcode, suburb, surplus_kwh, listed_price_per_kwh, status')
        .in('status', ['active', 'partially_filled'])
        .order('created_at', { ascending: false })
        .limit(12);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to load active listings from Supabase:', error.message);
        setRemoteLoaded(true);
        return;
      }

      const mapped = (data as RemoteListingRow[]).map((row, index) => {
        const normalizedSource = row.source_type.toLowerCase();
        const source: Listing['source'] =
          normalizedSource === 'wind'
            ? 'Wind'
            : normalizedSource === 'battery'
            ? 'Battery'
            : 'Solar';

        const neighborhood =
          row.suburb?.trim() ||
          (row.postcode ? `Postcode ${row.postcode}` : row.title?.replace(/ surplus listing$/i, '').trim()) ||
          `VoltShare seller ${index + 1}`;

        return {
          id: row.id,
          neighborhood,
          source,
          distanceKm: (0.8 + index * 0.6).toFixed(1),
          trust: row.postcode ? 'Verified area' : 'Verified meter',
          surplusKwh: Number(row.surplus_kwh),
          pricePerKwh: Number(row.listed_price_per_kwh),
          displayPricePerKwh: Number(row.listed_price_per_kwh),
          sellerUserId: row.user_id,
          postcode: row.postcode,
          suburb: row.suburb,
          isRemote: true,
          Icon: source === 'Wind' ? Wind : source === 'Battery' ? BatteryCharging : Sun,
        };
      });

      setRemoteListings(mapped);
      setRemoteLoaded(true);
    };

    void loadRemoteListings();

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
  }, [user?.id]);

  const listings = remoteListings.length > 0 ? remoteListings : fallbackListings;

  const handleConfirm = async (kwh: number) => {
    if (!activeListing) return;

    const totalCost = Number((kwh * activeListing.displayPricePerKwh).toFixed(2));

    if (supabase && user && activeListing.isRemote && activeListing.sellerUserId) {
      const remainingSurplus = Number((activeListing.surplusKwh - kwh).toFixed(2));
      const nextStatus = remainingSurplus <= 0.05 ? 'sold' : 'partially_filled';

      const { error: transactionError } = await supabase.from('transactions').insert({
        listing_id: activeListing.id,
        buyer_user_id: user.id,
        seller_user_id: activeListing.sellerUserId,
        source_type: activeListing.source.toLowerCase(),
        postcode: activeListing.postcode ?? null,
        suburb: activeListing.suburb ?? activeListing.neighborhood,
        kwh_traded: kwh,
        agreed_price_per_kwh: activeListing.displayPricePerKwh,
        total_amount: totalCost,
        status: 'completed',
      });

      if (transactionError) {
        console.error('Failed to save transaction to Supabase:', transactionError.message);
        return;
      }

      const { error: listingUpdateError } = await supabase
        .from('listings')
        .update({
          surplus_kwh: Math.max(0, remainingSurplus),
          status: nextStatus,
        })
        .eq('id', activeListing.id);

      if (listingUpdateError) {
        console.error('Failed to update listing status in Supabase:', listingUpdateError.message);
        return;
      }

      setRemoteListings((current) =>
        current
          .map((listing) =>
            listing.id === activeListing.id
              ? {
                  ...listing,
                  surplusKwh: Math.max(0, remainingSurplus),
                }
              : listing,
          )
          .filter((listing) => listing.id !== activeListing.id || remainingSurplus > 0.05),
      );
    }

    addPurchase({
      sellerNeighborhood: activeListing.neighborhood,
      source: activeListing.source,
      kwhBought: kwh,
      pricePerKwh: activeListing.displayPricePerKwh,
    });

    if (supabase && user) {
      const { error } = await supabase.from('purchases').insert({
        user_id: user.id,
        seller_neighborhood: activeListing.neighborhood,
        source: activeListing.source,
        kwh_bought: kwh,
        price_per_kwh: activeListing.displayPricePerKwh,
        total_cost: totalCost,
      });

      if (error) {
        console.error('Failed to save purchase to Supabase:', error.message);
      }
    }

    void trackAppEvent({
      eventName: 'complete_purchase',
      screen: 'buy',
      userId: user?.id ?? null,
      metadata: {
        seller: activeListing.neighborhood,
        source: activeListing.source,
        kwhBought: Number(kwh.toFixed(1)),
        pricePerKwh: Number(activeListing.displayPricePerKwh.toFixed(3)),
        totalCost,
        listingId: activeListing.id,
      },
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Marketplace</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Nearby renewable energy listings</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Browse local sellers, compare price per kWh, and choose the cleanest energy source that fits your needs.
        </p>
      </section>

      <div className="space-y-3">
        {listings.map((listing, index) => {
          const Icon = listing.Icon;
          return (
            <article
              key={listing.id}
              data-onboarding-id={index === 0 ? 'buy-first-listing' : undefined}
              className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-[1.1rem] bg-emerald-50 p-3 text-emerald-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-stone-950">{listing.neighborhood} energy seller</h3>
                    <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                      <MapPin className="h-4 w-4" />
                      {listing.distanceKm} km away
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                  {listing.source}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <ValueBlock label="Price" value={`${listing.displayPricePerKwh.toFixed(3)}/kWh`} />
                <ValueBlock label="Available" value={`${listing.surplusKwh.toFixed(1)} kWh`} />
                <ValueBlock label="Trust" value={listing.trust} compact />
              </div>

              <button
                type="button"
                onClick={() => setActiveListing(listing)}
                className="primary-btn mt-4 w-full"
              >
                <Zap className="h-4 w-4" />
                Buy energy
              </button>
            </article>
          );
        })}

        {remoteLoaded && listings.length === 0 ? (
          <div className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 text-sm leading-6 text-stone-600 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
            No active listings yet. Create one from the Sell tab and it will appear here.
          </div>
        ) : null}
      </div>

      {activeListing && (
        <BuyModal
          listing={activeListing}
          effectiveBalance={effectiveBalance}
          onClose={() => setActiveListing(null)}
          onConfirm={handleConfirm}
          userId={user?.id ?? null}
        />
      )}
    </div>
  );
}

/* ─── Buy modal ─── */
type BuyStep = 'input' | 'success';

function BuyModal({
  listing,
  effectiveBalance,
  onClose,
  onConfirm,
  userId,
}: {
  listing: Listing;
  effectiveBalance: number;
  onClose: () => void;
  onConfirm: (kwh: number) => Promise<void>;
  userId: string | null;
}) {
  const maxKwh = Math.floor(listing.surplusKwh * 10) / 10;
  const [kwh, setKwh] = useState(Math.min(1, maxKwh));
  const [step, setStep] = useState<BuyStep>('input');
  const [submitting, setSubmitting] = useState(false);

  const totalNumber = Number((kwh * listing.displayPricePerKwh).toFixed(2));
  const total = totalNumber.toFixed(2);
  const insufficientBalance = totalNumber > effectiveBalance + 0.0001;
  const Icon = listing.Icon;

  const handleConfirm = async () => {
    if (insufficientBalance) {
      void trackAppEvent({
        eventName: 'purchase_blocked_insufficient_balance',
        screen: 'buy',
        userId,
        metadata: {
          requiredBalance: totalNumber,
          walletBalance: effectiveBalance,
          seller: listing.neighborhood,
        },
      });
      return;
    }

    setSubmitting(true);
    await onConfirm(kwh);
    setSubmitting(false);
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-stone-950/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 mb-6 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_32px_80px_rgba(16,24,20,0.28)] sm:mb-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-[1rem] bg-emerald-50 p-2.5 text-emerald-800">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-950">{listing.neighborhood} energy seller</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{listing.distanceKm} km · {listing.source} · {listing.trust}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-stone-100 transition text-stone-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'input' ? (
          <>
            {/* How much to buy */}
            <div className="rounded-[1.4rem] border border-stone-100 bg-stone-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-stone-500 font-medium">How much to buy</p>
                <span className="text-xs text-stone-400">max {maxKwh} kWh</span>
              </div>

              {/* kWh selector */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setKwh((v) => Math.max(0.1, Math.round((v - 0.1) * 10) / 10))}
                  className="h-9 w-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:border-emerald-300 hover:text-emerald-700 transition font-semibold text-lg leading-none"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-semibold tracking-tight text-stone-950">{kwh.toFixed(1)}</span>
                  <span className="text-base text-stone-400 ml-1">kWh</span>
                </div>
                <button
                  type="button"
                  onClick={() => setKwh((v) => Math.min(maxKwh, Math.round((v + 0.1) * 10) / 10))}
                  className="h-9 w-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:border-emerald-300 hover:text-emerald-700 transition font-semibold text-lg leading-none"
                >
                  +
                </button>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0.1}
                max={maxKwh}
                step={0.1}
                value={kwh}
                onChange={(e) => setKwh(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            {/* Price breakdown */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">{kwh.toFixed(1)} kWh × ${listing.displayPricePerKwh.toFixed(3)}/kWh</span>
                <span className="font-medium text-stone-800">${total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Platform fee</span>
                <span className="font-medium text-emerald-700">Free</span>
              </div>
            <div className="flex justify-between text-sm border-t border-stone-100 pt-2 mt-2">
              <span className="font-semibold text-stone-900">Total</span>
              <span className="font-semibold text-emerald-800">${total}</span>
            </div>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-stone-100 bg-stone-50/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-stone-500">Wallet balance</span>
              <span className="font-medium text-stone-900">${effectiveBalance.toFixed(2)}</span>
            </div>
          </div>

          {insufficientBalance ? (
            <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              You do not have enough balance for this purchase. Top up first in Wallet to continue.
            </div>
          ) : null}

          {insufficientBalance ? (
            <Link
              to="/app/wallet"
              onClick={onClose}
              className="primary-btn mt-5 w-full justify-center"
            >
              Top up in Wallet
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="primary-btn mt-5 w-full"
              disabled={submitting}
            >
              {submitting ? 'Saving purchase...' : `Confirm purchase · $${total}`}
            </button>
          )}
        </>
      ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-stone-950">Purchase complete!</h3>
            <p className="mt-2 text-sm text-stone-500 leading-6">
              You bought <span className="font-semibold text-stone-800">{kwh.toFixed(1)} kWh</span> of {listing.source.toLowerCase()} energy from {listing.neighborhood} for{' '}
              <span className="font-semibold text-emerald-700">${total}</span>.
            </p>
            <div className="mt-5 w-full rounded-[1.3rem] bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">
              ⚡ Locally sourced · 0 grid emissions · Logged to your activity
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-[1.2rem] border border-stone-200 bg-white py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition"
            >
              Back to market
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ValueBlock({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-[1.2rem] bg-stone-50/80 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className={`mt-2 font-semibold text-stone-950 ${compact ? 'text-sm leading-5' : 'text-base'}`}>{value}</div>
    </div>
  );
}
