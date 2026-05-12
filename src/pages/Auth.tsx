import { ArrowLeft, ArrowRight, Leaf, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const handleEnter = () => {
    const trimmed = name.trim();
    if (trimmed) {
      try {
        localStorage.setItem('voltshare-demo-name', trimmed);
      } catch {
        // ignore storage errors
      }
    }
    void navigate('/experience');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">

        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
            Demo
          </span>
        </div>

        {/* Hero card */}
        <section className="rounded-[2.2rem] bg-emerald-950 px-5 py-6 text-white shadow-[0_24px_60px_rgba(16,24,20,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">VoltShare</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Enter the demo</h1>
              <p className="mt-3 max-w-[17rem] text-sm leading-6 text-emerald-50/80">
                No account needed. Explore P2P energy trading, ML-optimised pricing, and the analytics dashboard.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-3">
              <Leaf className="h-6 w-6 text-emerald-100" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <FeaturePill icon={Sparkles} label="ML pricing engine" />
            <FeaturePill icon={Leaf} label="P2P energy market" />
          </div>
        </section>

        {/* Entry form */}
        <section className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)]">
          <label className="field-block">
            <span className="field-label">Your name (optional)</span>
            <input
              className="input-control w-full"
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
              autoFocus
            />
          </label>

          <button
            type="button"
            className="primary-btn mt-4 w-full"
            onClick={handleEnter}
          >
            <ArrowRight className="h-4 w-4" />
            Enter demo
          </button>

          <p className="mt-4 text-center text-xs text-stone-400">
            This is a course project demo — no real energy is traded.
          </p>
        </section>

      </div>
    </main>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: typeof Leaf; label: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-emerald-100">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
