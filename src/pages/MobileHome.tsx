import { ArrowRight, Coins, Leaf, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store';
import { formatDateTime } from '@/lib/datetime';
import { getDemandStats, getMarketStats } from '@/services/aiService';

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

export default function MobileHome() {
  const marketReports = useStore((state) => state.marketReports);
  const demandBids = useStore((state) => state.demandBids);
  const optimizationHistory = useStore((state) => state.optimizationHistory);

  const marketStats = getMarketStats(marketReports);
  const demandStats = getDemandStats(demandBids);

  const bestWindow = [...marketReports]
    .sort((a, b) => b.surplusKwh - a.surplusKwh)
    .slice(0, 1)[0];
  const latestRun = optimizationHistory[0] ?? null;
  const walletProjection = optimizationHistory.reduce((sum, run) => sum + run.expectedRevenue, 0);
  const localSellers = marketReports.filter((report) => report.surplusKwh >= 1).length;

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-emerald-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(16,24,20,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Home</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Your local energy snapshot</h2>
            <p className="mt-2 max-w-[17rem] text-sm leading-6 text-emerald-100/80">
              A simple view of your surplus energy, the local market, and what VoltShare thinks is worth doing next.
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-white/10 px-3 py-2 text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/70">Live market</div>
            <div className="mt-1 text-lg font-semibold">{marketStats.averagePrice.toFixed(3)}/kWh</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricPill label="Available surplus" value={`${bestWindow?.surplusKwh.toFixed(1) ?? '0.0'} kWh`} icon={Leaf} />
          <MetricPill label="Potential wallet" value={currency.format(walletProjection)} icon={Coins} />
        </div>

        <div className="mt-5 rounded-[1.6rem] bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">Suggested sell price</p>
              <p className="mt-1 text-2xl font-semibold">
                {latestRun ? `${latestRun.optimizedPrice.toFixed(3)}/kWh` : `${(bestWindow?.pricePerKwh ?? marketStats.averagePrice).toFixed(3)}/kWh`}
              </p>
            </div>
            <Link to="/app/sell" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-emerald-950">
              Sell now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-3 text-sm leading-6 text-emerald-50/85">
            {latestRun
              ? `Your latest optimized run projected ${currency.format(latestRun.expectedRevenue)} in expected earnings.`
              : 'You have not run a pricing recommendation yet. Start with Sell to get an intelligent listing suggestion.'}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <QuickAction to="/app/market" label="Buy Energy" icon={ShoppingBag} tone="mint" />
        <QuickAction to="/app/sell" label="Sell Energy" icon={Sparkles} tone="dark" />
        <QuickAction to="/app/activity" label="View Activity" icon={TrendingUp} tone="light" />
      </section>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Market pulse</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">What is happening nearby</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            {localSellers} local listings
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="Demand pressure" value={`${demandStats.averageBid.toFixed(3)}/kWh`} note="Average buyer willingness" />
          <MiniCard title="Best surplus window" value={bestWindow ? formatDateTime(bestWindow.reportedAt, compactDate) : '--'} note="Strongest supply hour in the current data" />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Recent activity</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Latest pricing runs</h3>
          </div>
          <Link to="/activity" className="text-sm font-medium text-emerald-800">
            See all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {optimizationHistory.length > 0 ? (
            optimizationHistory.slice(0, 2).map((run) => (
              <div key={run.id} className="rounded-[1.4rem] border border-stone-200 bg-stone-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-stone-950">{run.surplusKwh.toFixed(1)} kWh listing</div>
                    <div className="text-sm text-stone-500">{formatDateTime(run.createdAt, compactDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-emerald-900">{run.optimizedPrice.toFixed(3)}/kWh</div>
                    <div className="text-sm text-stone-500">{currency.format(run.expectedRevenue)}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-stone-300 bg-stone-50/60 px-4 py-5 text-sm leading-6 text-stone-500">
              No pricing runs yet. Try the Sell tab to generate your first recommendation.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Advanced view</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Need the full AML dashboard?</h3>
          </div>
          <Link to="/analytics" className="secondary-btn">
            Open analytics
          </Link>
        </div>
      </section>
    </div>
  );
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Leaf;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-emerald-100/80">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  icon: typeof Sparkles;
  tone: 'mint' | 'dark' | 'light';
}) {
  const toneClass =
    tone === 'dark'
      ? 'bg-stone-950 text-white'
      : tone === 'mint'
        ? 'bg-emerald-100 text-emerald-950'
        : 'bg-white text-stone-950';

  return (
    <Link
      to={to}
      className={`flex min-h-[110px] flex-col justify-between rounded-[1.7rem] border border-white/80 p-4 shadow-[0_16px_32px_rgba(38,84,62,0.08)] ${toneClass}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium leading-5">{label}</span>
    </Link>
  );
}

function MiniCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-stone-500">{note}</p>
    </div>
  );
}
