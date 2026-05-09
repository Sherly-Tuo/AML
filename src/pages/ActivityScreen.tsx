import { ArrowUpRight, Clock3, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from '@/store';
import { formatDateTime } from '@/lib/datetime';
import type { OptimizationRun, Purchase } from '@/types';

const compactDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

type FeedItem =
  | { kind: 'sell'; data: OptimizationRun }
  | { kind: 'buy';  data: Purchase };

export default function ActivityScreen() {
  const optimizationHistory = useStore((s) => s.optimizationHistory);
  const purchases          = useStore((s) => s.purchases);

  // Merge and sort by time descending
  const feed = useMemo<FeedItem[]>(() => {
    const sells: FeedItem[] = optimizationHistory.map((r) => ({ kind: 'sell', data: r }));
    const buys:  FeedItem[] = purchases.map((p) => ({ kind: 'buy',  data: p }));
    return [...sells, ...buys].sort((a, b) => {
      const ta = a.kind === 'sell' ? a.data.createdAt : a.data.boughtAt;
      const tb = b.kind === 'sell' ? b.data.createdAt : b.data.boughtAt;
      return tb.localeCompare(ta);
    });
  }, [optimizationHistory, purchases]);

  return (
    <div className="space-y-4">
      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Activity</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Your energy activity</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          A live log of every energy purchase and pricing run you've made in VoltShare.
        </p>
      </section>

      {/* Summary pills */}
      {feed.length > 0 && (
        <div className="flex gap-3">
          <SummaryPill
            label="Purchases"
            value={purchases.length}
            sub={`$${purchases.reduce((s, p) => s + p.totalCost, 0).toFixed(2)} spent`}
            color="emerald"
          />
          <SummaryPill
            label="Sell runs"
            value={optimizationHistory.length}
            sub={`${optimizationHistory.reduce((s, r) => s + r.surplusKwh, 0).toFixed(1)} kWh listed`}
            color="sky"
          />
        </div>
      )}

      <div className="space-y-3">
        {feed.length > 0 ? (
          feed.map((item) =>
            item.kind === 'buy' ? (
              <BuyCard key={item.data.id} purchase={item.data} />
            ) : (
              <SellCard key={item.data.id} run={item.data} />
            ),
          )
        ) : (
          <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-white/75 px-5 py-8 text-center text-sm leading-6 text-stone-500">
            No activity yet. Buy energy from the Market tab or use Sell to generate your first recommendation.
          </div>
        )}
      </div>
    </div>
  );
}

function BuyCard({ purchase }: { purchase: Purchase }) {
  return (
    <article className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-[1rem] bg-emerald-50 p-2.5 text-emerald-700">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-950">
              Bought {purchase.kwhBought.toFixed(1)} kWh · {purchase.sellerNeighborhood}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(purchase.boughtAt, compactDate)}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
          purchased
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Source" value={purchase.source} />
        <Metric label="Rate" value={`$${purchase.pricePerKwh.toFixed(3)}/kWh`} />
        <Metric label="Total paid" value={`$${purchase.totalCost.toFixed(2)}`} highlight />
      </div>
    </article>
  );
}

function SellCard({ run }: { run: OptimizationRun }) {
  return (
    <article className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-[1rem] bg-sky-50 p-2.5 text-sky-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-950">{run.surplusKwh.toFixed(1)} kWh listing</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(run.createdAt, compactDate)}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-sky-800">
          listed
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Input" value={`$${run.inputPrice.toFixed(3)}/kWh`} />
        <Metric label="Optimised" value={`$${run.optimizedPrice.toFixed(3)}/kWh`} />
        <Metric label="Expected" value={`$${run.expectedRevenue.toFixed(2)}`} highlight />
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
        AI recommendation generated
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </article>
  );
}

function SummaryPill({
  label, value, sub, color,
}: {
  label: string; value: number; sub: string; color: 'emerald' | 'sky';
}) {
  const cls = color === 'emerald'
    ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
    : 'bg-sky-50 border-sky-100 text-sky-900';
  return (
    <div className={`flex-1 rounded-[1.4rem] border px-4 py-3 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-60">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-[1.2rem] bg-stone-50/80 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${highlight ? 'text-emerald-700' : 'text-stone-950'}`}>{value}</div>
    </div>
  );
}
