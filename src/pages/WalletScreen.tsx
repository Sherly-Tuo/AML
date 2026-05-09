import { BadgeCheck, Leaf, Settings2, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useStore } from '@/store';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function WalletScreen() {
  const { user, profile } = useAuth();
  const optimizationHistory = useStore((state) => state.optimizationHistory);

  const walletBalance = optimizationHistory.reduce((sum, run) => sum + run.expectedRevenue, 0);
  const totalEnergy = optimizationHistory.reduce((sum, run) => sum + run.surplusKwh, 0);
  const carbonSavedKg = totalEnergy * 0.42;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.8rem] bg-emerald-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(16,24,20,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Wallet</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{currency.format(walletBalance)}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              Estimated earnings from the pricing runs and listings you have created in VoltShare.
            </p>
          </div>
          <div className="rounded-[1.4rem] bg-white/10 p-3">
            <Wallet className="h-6 w-6 text-emerald-100" />
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <div className="flex items-center gap-3">
          <div className="rounded-[1.2rem] bg-emerald-50 p-3 text-emerald-800">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-stone-950">{profile?.display_name || user?.email || 'Guest account'}</p>
            <p className="text-sm text-stone-500">{profile?.postcode ? `Postcode ${profile.postcode}` : 'No postcode added yet'}</p>
          </div>
        </div>

        {!user ? (
          <div className="mt-4 rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Sign in to attach your runs to a real profile and unlock account-based history later.
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <ImpactCard icon={Leaf} label="Carbon saved" value={`${carbonSavedKg.toFixed(1)} kg`} />
        <ImpactCard icon={Settings2} label="Energy traded" value={`${totalEnergy.toFixed(1)} kWh`} />
      </div>

      <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Settings & tools</p>
        <div className="mt-4 space-y-3">
          <Link to="/auth" className="secondary-btn w-full justify-between">
            Manage sign-in
            <span>Open</span>
          </Link>
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
