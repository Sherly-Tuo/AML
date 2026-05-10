import { BadgeCheck, Camera, Coins, CreditCard, Leaf, LoaderCircle, Settings2, Wallet } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { trackAppEvent } from '@/services/analytics';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function WalletScreen() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const optimizationHistory = useStore((state) => state.optimizationHistory);
  const purchases = useStore((state) => state.purchases);
  const walletCredits = useStore((state) => state.walletCredits);
  const redeemPromoCode = useStore((state) => state.redeemPromoCode);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarStatus, setAvatarStatus] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [remoteCredits, setRemoteCredits] = useState<number | null>(null);
  const [remoteProjectedEarnings, setRemoteProjectedEarnings] = useState<number | null>(null);
  const [remoteSpent, setRemoteSpent] = useState<number | null>(null);
  const [remoteEnergySold, setRemoteEnergySold] = useState<number | null>(null);
  const [remoteEnergyBought, setRemoteEnergyBought] = useState<number | null>(null);
  const [topUpNoticeOpen, setTopUpNoticeOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState('');

  useEffect(() => {
    if (!supabase || !user) {
      setWalletLoading(false);
      setWalletError('');
      setRemoteCredits(null);
      setRemoteProjectedEarnings(null);
      setRemoteSpent(null);
      setRemoteEnergySold(null);
      setRemoteEnergyBought(null);
      return;
    }

    const client = supabase;
    let isMounted = true;

    const loadWalletData = async () => {
      setWalletLoading(true);
      setWalletError('');

      const [creditsResult, runsResult, purchasesResult, transactionsResult] = await Promise.all([
        client
          .from('wallet_credit_events')
          .select('amount')
          .eq('user_id', user.id),
        client
          .from('recommendation_runs')
          .select('expected_revenue, surplus_kwh')
          .eq('user_id', user.id),
        client
          .from('purchases')
          .select('total_cost, kwh_bought')
          .eq('user_id', user.id),
        client
          .from('transactions')
          .select('buyer_user_id, seller_user_id, total_amount, kwh_traded')
          .or(`buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`),
      ]);

      if (!isMounted) {
        return;
      }

      if (creditsResult.error || runsResult.error || purchasesResult.error || transactionsResult.error) {
        console.error(
          'Failed to load wallet data from Supabase:',
          creditsResult.error?.message ??
            runsResult.error?.message ??
            purchasesResult.error?.message ??
            transactionsResult.error?.message,
        );
        setWalletError('Cloud wallet sync is unavailable right now. Showing local totals instead.');
        setRemoteCredits(null);
        setRemoteProjectedEarnings(null);
        setRemoteSpent(null);
        setRemoteEnergySold(null);
        setRemoteEnergyBought(null);
        setWalletLoading(false);
        return;
      }

      const creditTotal = (creditsResult.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      const projected = (runsResult.data ?? []).reduce((sum, row) => sum + Number(row.expected_revenue ?? 0), 0);
      const transactionRows = transactionsResult.data ?? [];
      const hasTransactionRows = transactionRows.length > 0;
      const spentFromTransactions = transactionRows
        .filter((row) => row.buyer_user_id === user.id)
        .reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
      const soldFromTransactions = transactionRows
        .filter((row) => row.seller_user_id === user.id)
        .reduce((sum, row) => sum + Number(row.kwh_traded ?? 0), 0);
      const boughtFromTransactions = transactionRows
        .filter((row) => row.buyer_user_id === user.id)
        .reduce((sum, row) => sum + Number(row.kwh_traded ?? 0), 0);
      const fallbackSpent = (purchasesResult.data ?? []).reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0);
      const fallbackBought = (purchasesResult.data ?? []).reduce((sum, row) => sum + Number(row.kwh_bought ?? 0), 0);
      const fallbackSold = (runsResult.data ?? []).reduce((sum, row) => sum + Number(row.surplus_kwh ?? 0), 0);

      setRemoteCredits(Number(creditTotal.toFixed(2)));
      setRemoteProjectedEarnings(Number(projected.toFixed(2)));
      setRemoteSpent(Number((hasTransactionRows ? spentFromTransactions : fallbackSpent).toFixed(2)));
      setRemoteEnergySold(Number((hasTransactionRows ? soldFromTransactions : fallbackSold).toFixed(2)));
      setRemoteEnergyBought(Number((hasTransactionRows ? boughtFromTransactions : fallbackBought).toFixed(2)));
      setWalletLoading(false);
    };

    void loadWalletData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const localProjectedEarnings = optimizationHistory.reduce((sum, run) => sum + run.expectedRevenue, 0);
  const localTotalSpent = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
  const effectiveCredits = user && remoteCredits !== null ? remoteCredits : walletCredits;
  const projectedEarnings = user && remoteProjectedEarnings !== null ? remoteProjectedEarnings : localProjectedEarnings;
  const totalSpent = user && remoteSpent !== null ? remoteSpent : localTotalSpent;
  const walletBalance = effectiveCredits + projectedEarnings - totalSpent;
  const localTotalEnergy = optimizationHistory.reduce((sum, run) => sum + run.surplusKwh, 0);
  const totalEnergySold = user && remoteEnergySold !== null ? remoteEnergySold : localTotalEnergy;
  const totalEnergyBought = user && remoteEnergyBought !== null ? remoteEnergyBought : purchases.reduce((sum, purchase) => sum + purchase.kwhBought, 0);
  const totalEnergy = totalEnergySold + totalEnergyBought;
  const carbonSavedKg = totalEnergy * 0.42;

  useEffect(() => {
    void trackAppEvent({
      eventName: 'view_wallet_screen',
      screen: 'wallet',
      userId: user?.id ?? null,
      metadata: {
        signedIn: Boolean(user),
        walletBalance: Number(walletBalance.toFixed(2)),
      },
    });
  }, [user?.id, walletBalance]);

  const handleTopUp = async () => {
    void trackAppEvent({
      eventName: 'click_top_up',
      screen: 'wallet',
      userId: user?.id ?? null,
      metadata: {
        method: 'top_up_info_only',
      },
    });

    setTopUpNoticeOpen((current) => !current);
  };

  const handleRedeemCode = async () => {
    const normalizedCode = promoCode.trim().toUpperCase();
    const result = redeemPromoCode(promoCode);
    setPromoStatus(result.message);

    if (!result.success) {
      return;
    }

    if (supabase && user) {
      const { error } = await supabase.from('wallet_credit_events').insert({
        user_id: user.id,
        event_type: 'promo_code',
        amount: result.creditAdded ?? 0,
        promo_code: normalizedCode,
        notes: 'Promo credit redeemed from Wallet screen',
      });

      if (error) {
        console.error('Failed to save promo credit event to Supabase:', error.message);
      } else {
        setRemoteCredits((current) => Number(((current ?? effectiveCredits) + (result.creditAdded ?? 0)).toFixed(2)));
      }
    }

    void trackAppEvent({
      eventName: 'redeem_promo_code',
      screen: 'wallet',
      userId: user?.id ?? null,
      metadata: {
        code: normalizedCode,
        creditAdded: result.creditAdded ?? 0,
      },
    });
    setPromoCode('');
  };

  const handlePickAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarStatus('Please upload an image file.');
      return;
    }

    if (file.size > 1_500_000) {
      setAvatarStatus('Please keep the avatar under 1.5 MB.');
      return;
    }

    setUploadingAvatar(true);
    setAvatarStatus('');

    const reader = new FileReader();
    reader.onload = async () => {
      const avatarUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!avatarUrl) {
        setUploadingAvatar(false);
        setAvatarStatus('We could not read that image.');
        return;
      }

      const { error } = await updateProfile({ avatar_url: avatarUrl });

      if (error) {
        setAvatarStatus(`Avatar upload failed: ${error}`);
      } else {
        setAvatarStatus('Profile photo updated.');
        void trackAppEvent({
          eventName: 'upload_avatar',
          screen: 'wallet',
          userId: user.id,
          metadata: {
            fileSizeKb: Math.round(file.size / 1024),
          },
        });
      }

      setUploadingAvatar(false);
    };

    reader.onerror = () => {
      setUploadingAvatar(false);
      setAvatarStatus('We could not read that image.');
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <section data-onboarding-id="wallet-credits" className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile avatar"
                className="h-12 w-12 rounded-[1.2rem] object-cover ring-1 ring-emerald-100"
              />
            ) : (
              <div className="rounded-[1.2rem] bg-emerald-50 p-3 text-emerald-800">
                <BadgeCheck className="h-5 w-5" />
              </div>
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-stone-950">{profile?.display_name || user?.email || 'Guest account'}</p>
            <p className="text-sm text-stone-500">{profile?.postcode ? `Postcode ${profile.postcode}` : 'No postcode added yet'}</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handlePickAvatar(event)}
        />

        {!user ? (
          <div className="mt-4">
            <Link to="/auth" className="secondary-btn w-full justify-between">
              Sign in
              <span>Open</span>
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="secondary-btn w-full justify-between"
              disabled={uploadingAvatar}
            >
              <span className="inline-flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {uploadingAvatar ? 'Uploading photo...' : profile?.avatar_url ? 'Change profile photo' : 'Upload profile photo'}
              </span>
              <span>{profile?.avatar_url ? 'Edit' : 'Add'}</span>
            </button>

            {avatarStatus ? (
              <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                {avatarStatus}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-[1.8rem] bg-emerald-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(16,24,20,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Wallet</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{currency.format(walletBalance)}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              Credits, projected earnings, and purchase costs combined into a demo wallet balance.
            </p>
          </div>
          <div className="rounded-[1.4rem] bg-white/10 p-3">
            <Wallet className="h-6 w-6 text-emerald-100" />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleTopUp()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-emerald-950 shadow-[0_10px_24px_rgba(16,24,20,0.14)]"
          >
            <CreditCard className="h-4 w-4" />
            Top Up
          </button>
        </div>
      </section>

      {walletError ? (
        <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {walletError}
        </div>
      ) : null}

      {topUpNoticeOpen ? (
        <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Wallet top-up is not linked to a payment provider yet. Use the redeem code below instead.
        </div>
      ) : null}

      {walletLoading ? (
        <div className="flex items-center gap-2 rounded-[1.2rem] border border-white/80 bg-white/85 px-4 py-3 text-sm text-stone-600 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Syncing wallet totals from Supabase...
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <ImpactCard icon={Leaf} label="Carbon saved" value={`${carbonSavedKg.toFixed(1)} kg`} />
        <ImpactCard icon={Settings2} label="Energy traded" value={`${totalEnergy.toFixed(1)} kWh`} />
      </div>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Redeem credits</p>
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
      </section>

      <div className="grid grid-cols-3 gap-3">
        <ImpactCard icon={Wallet} label="Credits" value={currency.format(effectiveCredits)} />
        <ImpactCard icon={Coins} label="Projected earnings" value={currency.format(projectedEarnings)} />
        <ImpactCard icon={BadgeCheck} label="Purchases" value={currency.format(totalSpent)} />
      </div>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Settings & tools</p>
        <div className="mt-4 space-y-3">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="secondary-btn w-full justify-between"
            >
              Sign out
              <span>Open</span>
            </button>
          ) : null}
          <Link to="/analytics" className="secondary-btn w-full justify-between">
            Open full analytics dashboard
            <span>Open</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ImpactCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Leaf;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.8rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
      <div className="rounded-[1rem] bg-emerald-50 p-2 text-emerald-800 w-fit">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-stone-950">{value}</div>
    </div>
  );
}
