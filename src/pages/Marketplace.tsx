import { BatteryCharging, CheckCircle2, MapPin, Sun, Wind, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import type { Purchase } from '@/types';

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
  Icon: (typeof sourceIcons)[number];
};

export default function Marketplace() {
  const marketReports = useStore((s) => s.marketReports);
  const addPurchase = useStore((s) => s.addPurchase);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);

  const listings = useMemo<Listing[]>(
    () =>
      [...marketReports]
        .filter((r) => r.surplusKwh > 0.2)
        .sort((a, b) => a.pricePerKwh - b.pricePerKwh)
        .slice(0, 10)
        .map((r, i) => ({
          ...r,
          source: sourceLabels[i % sourceLabels.length],
          distanceKm: (0.8 + i * 0.7).toFixed(1),
          neighborhood: ['Northcote', 'Brunswick', 'Carlton', 'Footscray', 'Fitzroy'][i % 5],
          trust: ['Verified meter', 'Green household', 'Fast responder'][i % 3],
          Icon: sourceIcons[i % sourceIcons.length],
        })),
    [marketReports],
  );

  const handleConfirm = (kwh: number) => {
    if (!activeListing) return;
    addPurchase({
      sellerNeighborhood: activeListing.neighborhood,
      source: activeListing.source,
      kwhBought: kwh,
      pricePerKwh: activeListing.pricePerKwh,
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
        {listings.map((listing) => {
          const Icon = listing.Icon;
          return (
            <article
              key={listing.id}
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
                <ValueBlock label="Price" value={`${listing.pricePerKwh.toFixed(3)}/kWh`} />
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
      </div>

      {activeListing && (
        <BuyModal
          listing={activeListing}
          onClose={() => setActiveListing(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

/* ─── Buy modal ─── */
type BuyStep = 'input' | 'success';

function BuyModal({
  listing,
  onClose,
  onConfirm,
}: {
  listing: Listing;
  onClose: () => void;
  onConfirm: (kwh: number) => void;
}) {
  const maxKwh = Math.floor(listing.surplusKwh * 10) / 10;
  const [kwh, setKwh] = useState(Math.min(1, maxKwh));
  const [step, setStep] = useState<BuyStep>('input');

  const total = (kwh * listing.pricePerKwh).toFixed(2);
  const Icon = listing.Icon;

  const handleConfirm = () => {
    onConfirm(kwh);
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
                <span className="text-stone-500">{kwh.toFixed(1)} kWh × ${listing.pricePerKwh.toFixed(3)}/kWh</span>
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

            <button
              type="button"
              onClick={handleConfirm}
              className="primary-btn mt-5 w-full"
            >
              Confirm purchase · ${total}
            </button>
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
