import { ArrowRight, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Intro() {
  const navigate = useNavigate();

  return (
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">

        {/* Hero */}
        <section className="flex-1 rounded-[2.3rem] bg-emerald-950 px-6 py-7 text-white shadow-[0_24px_60px_rgba(16,24,20,0.22)] flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">VoltShare</p>
            <div className="rounded-[1.4rem] bg-white/10 p-3">
              <Leaf className="h-5 w-5 text-emerald-200" />
            </div>
          </div>
          <div>
            <h1 className="text-[2.4rem] font-semibold leading-[1.1] tracking-tight">
              Trade clean energy<br />with your<br />neighbour.
            </h1>
            <p className="mt-3 text-sm leading-6 text-emerald-50/75 max-w-[17rem]">
              Peer-to-peer renewable energy with algorithm-driven pricing, saved activity, and account-based profiles.
            </p>
            <div className="mt-5 flex gap-3">
              <FeaturePill icon={Sparkles} label="ML pricing" />
              <FeaturePill icon={ShieldCheck} label="Local flow" />
            </div>
          </div>
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard value="P2P" label="Direct trading" />
          <StatCard value="ML" label="Price optimiser" />
          <StatCard value="Sync" label="Profile + history" />
        </div>

        {/* CTAs */}
        <div className="mt-auto space-y-3 pb-2">
          <a
            href="/auth"
            className="primary-btn w-full"
            onClick={(e) => { e.preventDefault(); void navigate('/auth'); }}
          >
            Sign in to VoltShare
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            className="secondary-btn w-full"
            onClick={() => void navigate('/experience')}
          >
            Continue without signing in
          </button>
        </div>
      </div>
    </main>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-emerald-100">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-4 text-center shadow-[0_8px_24px_rgba(38,84,62,0.07)]">
      <p className="text-xl font-semibold tracking-tight text-emerald-800">{value}</p>
      <p className="mt-1 text-[11px] text-stone-500">{label}</p>
    </div>
  );
}
