import { ArrowUpRight, Clock3, LoaderCircle, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { trackAppEvent } from '@/services/analytics';
import { supabase } from '@/lib/supabase';
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
  | { kind: 'buy'; data: Purchase }
  | { kind: 'transaction'; data: TransactionRecord };

type ActiveListingRecord = {
  id: string;
  title: string | null;
  surplusKwh: number;
  listedPricePerKwh: number;
  estimatedRevenue: number | null;
  status: string;
  availableFrom: string | null;
  createdAt: string;
};

function isReasonableHouseholdSurplus(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

type TransactionRecord = {
  id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  sourceType: string;
  suburb: string | null;
  postcode: string | null;
  kwhTraded: number;
  agreedPricePerKwh: number;
  totalAmount: number;
  status: string;
  purchasedAt: string;
};

export default function ActivityScreen() {
  const { user } = useAuth();
  const optimizationHistory = useStore((s) => s.optimizationHistory);
  const purchases = useStore((s) => s.purchases);
  const [remoteRuns, setRemoteRuns] = useState<OptimizationRun[] | null>(null);
  const [remotePurchases, setRemotePurchases] = useState<Purchase[] | null>(null);
  const [remoteTransactions, setRemoteTransactions] = useState<TransactionRecord[] | null>(null);
  const [activeListings, setActiveListings] = useState<ActiveListingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [cancellingListingId, setCancellingListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setRemoteRuns(null);
      setRemotePurchases(null);
      setRemoteTransactions(null);
      setHistoryLoading(false);
      setHistoryError('');
      return;
    }

    const client = supabase;
    let isMounted = true;

    const loadRuns = async () => {
      setHistoryLoading(true);
      setHistoryError('');

      const [runsResult, purchasesResult, transactionsResult, listingsResult] = await Promise.all([
        client
          .from('recommendation_runs')
          .select('id, surplus_kwh, input_price, optimized_price, expected_revenue, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        client
          .from('purchases')
          .select('id, seller_neighborhood, source, kwh_bought, price_per_kwh, total_cost, bought_at')
          .eq('user_id', user.id)
          .order('bought_at', { ascending: false })
          .limit(20),
        client
          .from('transactions')
          .select('id, listing_id, buyer_user_id, seller_user_id, source_type, suburb, postcode, kwh_traded, agreed_price_per_kwh, total_amount, status, purchased_at')
          .or(`buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`)
          .order('purchased_at', { ascending: false })
          .limit(20),
        client
          .from('listings')
          .select('id, title, surplus_kwh, listed_price_per_kwh, estimated_revenue, status, available_from, created_at')
          .eq('user_id', user.id)
          .in('status', ['active', 'partially_filled'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (!isMounted) {
        return;
      }

      if (runsResult.error || purchasesResult.error || transactionsResult.error || listingsResult.error) {
        console.error(
          'Failed to load activity from Supabase:',
          runsResult.error?.message ?? purchasesResult.error?.message ?? transactionsResult.error?.message ?? listingsResult.error?.message,
        );
        setHistoryError('Cloud history is unavailable right now. Showing local activity instead.');
        setRemoteRuns(null);
        setRemotePurchases(null);
        setRemoteTransactions(null);
        setActiveListings([]);
        setHistoryLoading(false);
        return;
      }

      setRemoteRuns(
        (runsResult.data ?? []).map((row) => ({
          id: String(row.id),
          surplusKwh: Number(row.surplus_kwh),
          inputPrice: Number(row.input_price),
          optimizedPrice: Number(row.optimized_price),
          expectedRevenue: Number(row.expected_revenue),
          createdAt: String(row.created_at),
        })),
      );
      setRemotePurchases(
        (purchasesResult.data ?? []).map((row) => ({
          id: String(row.id),
          sellerNeighborhood: String(row.seller_neighborhood),
          source: String(row.source),
          kwhBought: Number(row.kwh_bought),
          pricePerKwh: Number(row.price_per_kwh),
          totalCost: Number(row.total_cost),
          boughtAt: String(row.bought_at),
        })),
      );
      setRemoteTransactions(
        (transactionsResult.data ?? []).map((row) => ({
          id: String(row.id),
          listingId: String(row.listing_id),
          buyerUserId: String(row.buyer_user_id),
          sellerUserId: String(row.seller_user_id),
          sourceType: String(row.source_type),
          suburb: row.suburb ? String(row.suburb) : null,
          postcode: row.postcode ? String(row.postcode) : null,
          kwhTraded: Number(row.kwh_traded),
          agreedPricePerKwh: Number(row.agreed_price_per_kwh),
          totalAmount: Number(row.total_amount),
          status: String(row.status),
          purchasedAt: String(row.purchased_at),
        })),
      );
      setActiveListings(
        (listingsResult.data ?? []).map((row) => ({
          id: String(row.id),
          title: row.title ? String(row.title) : null,
          surplusKwh: Number(row.surplus_kwh),
          listedPricePerKwh: Number(row.listed_price_per_kwh),
          estimatedRevenue: row.estimated_revenue === null ? null : Number(row.estimated_revenue),
          status: String(row.status),
          availableFrom: row.available_from ? String(row.available_from) : null,
          createdAt: String(row.created_at),
        })),
      );
      setHistoryLoading(false);
    };

    void loadRuns();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleCancelListing = async (listingId: string) => {
    if (!supabase || !user) {
      return;
    }

    setCancellingListingId(listingId);
    const { error } = await supabase
      .from('listings')
      .update({ status: 'cancelled' })
      .eq('id', listingId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to cancel listing:', error.message);
      setHistoryError(`Could not cancel listing: ${error.message}`);
      setCancellingListingId(null);
      return;
    }

    setActiveListings((current) => current.filter((listing) => listing.id !== listingId));
    void trackAppEvent({
      eventName: 'cancel_listing',
      screen: 'activity',
      userId: user.id,
      metadata: {
        listingId,
      },
    });
    setCancellingListingId(null);
  };

  const sellRuns = (user && remoteRuns ? remoteRuns : optimizationHistory).filter((run) =>
    isReasonableHouseholdSurplus(run.surplusKwh),
  );
  const buyRuns = user && remotePurchases ? remotePurchases : purchases;
  const transactionRuns = user && remoteTransactions ? remoteTransactions : [];

  // Merge and sort by time descending
  const feed = useMemo<FeedItem[]>(() => {
    const sells: FeedItem[] = sellRuns.map((r) => ({ kind: 'sell', data: r }));
    const buys: FeedItem[] = buyRuns.map((p) => ({ kind: 'buy', data: p }));
    const transactions: FeedItem[] = transactionRuns.map((t) => ({ kind: 'transaction', data: t }));
    return [...sells, ...transactions, ...buys].sort((a, b) => {
      const ta = a.kind === 'sell' ? a.data.createdAt : a.kind === 'transaction' ? a.data.purchasedAt : a.data.boughtAt;
      const tb = b.kind === 'sell' ? b.data.createdAt : b.kind === 'transaction' ? b.data.purchasedAt : b.data.boughtAt;
      return tb.localeCompare(ta);
    });
  }, [buyRuns, sellRuns, transactionRuns]);

  return (
    <div className="space-y-4">
      <section data-onboarding-id="activity-screen" className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Activity</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Your energy activity</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          A live log of every energy purchase and pricing run you've made in VoltShare.
        </p>
      </section>

      {historyError ? (
        <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {historyError}
        </div>
      ) : null}

      {historyLoading ? (
        <div className="flex items-center gap-2 rounded-[1.2rem] border border-white/80 bg-white/85 px-4 py-3 text-sm text-stone-600 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Syncing recommendation history from Supabase...
        </div>
      ) : null}

      {activeListings.length > 0 ? (
        <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Active listings</p>
          <div className="mt-4 space-y-3">
            {activeListings.map((listing) => (
              <article key={listing.id} className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-950">
                      {listing.surplusKwh.toFixed(1)} kWh listed
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {formatDateTime(listing.availableFrom ?? listing.createdAt, compactDate)}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    {listing.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <Metric label="List price" value={`$${listing.listedPricePerKwh.toFixed(3)}/kWh`} />
                  <Metric label="Available" value={`${listing.surplusKwh.toFixed(1)} kWh`} />
                  <Metric
                    label="Expected"
                    value={listing.estimatedRevenue !== null ? `$${listing.estimatedRevenue.toFixed(2)}` : '--'}
                    highlight
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleCancelListing(listing.id)}
                  disabled={cancellingListingId === listing.id}
                  className="secondary-btn mt-4 w-full justify-center"
                >
                  {cancellingListingId === listing.id ? 'Cancelling…' : 'Cancel listing'}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Summary pills */}
      {feed.length > 0 && (
        <div className="flex gap-3">
          <SummaryPill
            label="Purchases"
            value={buyRuns.length}
            sub={`$${buyRuns.reduce((s, p) => s + p.totalCost, 0).toFixed(2)} spent`}
            color="emerald"
          />
          <SummaryPill
            label="Sell runs"
            value={sellRuns.length}
            sub={`${sellRuns.reduce((s, r) => s + r.surplusKwh, 0).toFixed(1)} kWh listed`}
            color="sky"
          />
        </div>
      )}

      <div className="space-y-3">
        {feed.length > 0 ? (
          feed.map((item) =>
            item.kind === 'buy' ? (
              <BuyCard key={item.data.id} purchase={item.data} />
            ) : item.kind === 'transaction' ? (
              <TransactionCard key={item.data.id} transaction={item.data} currentUserId={user?.id ?? null} />
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
            <div className="text-sm font-semibold text-stone-950">Sell recommendation · {run.surplusKwh.toFixed(1)} kWh</div>
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

function TransactionCard({
  transaction,
  currentUserId,
}: {
  transaction: TransactionRecord;
  currentUserId: string | null;
}) {
  const isBuyer = transaction.buyerUserId === currentUserId;
  const directionLabel = isBuyer ? 'bought' : 'sold';
  const locationLabel = transaction.suburb || (transaction.postcode ? `Postcode ${transaction.postcode}` : 'Local trade');

  return (
    <article className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-[1rem] p-2.5 ${isBuyer ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
            {isBuyer ? <ShoppingBag className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-950">
              {directionLabel === 'bought' ? 'Bought' : 'Sold'} {transaction.kwhTraded.toFixed(1)} kWh · {locationLabel}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(transaction.purchasedAt, compactDate)}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
            isBuyer ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
          }`}
        >
          {directionLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Source" value={transaction.sourceType} />
        <Metric label="Rate" value={`$${transaction.agreedPricePerKwh.toFixed(3)}/kWh`} />
        <Metric label={isBuyer ? 'Total paid' : 'Revenue'} value={`$${transaction.totalAmount.toFixed(2)}`} highlight />
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
