import { ArrowLeft, ArrowRight, BarChart3, Smartphone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const ONBOARDING_START_KEY = 'voltshare-guided-onboarding-start';

export default function ExperienceHub() {
  const navigate = useNavigate();
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);

  const handleEnterApp = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowFirstTimeModal(true);
  };

  const handleLaunchOnboarding = () => {
    try {
      window.sessionStorage.setItem(ONBOARDING_START_KEY, '1');
      window.localStorage.removeItem('voltshare-guided-onboarding-v1');
    } catch {
      // ignore storage failures
    }
    setShowFirstTimeModal(false);
    void navigate('/app');
  };

  const handleSkipOnboarding = () => {
    try {
      window.sessionStorage.removeItem(ONBOARDING_START_KEY);
    } catch {
      // ignore storage failures
    }
    setShowFirstTimeModal(false);
    void navigate('/app');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">
        <section className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)]">
          <p className="eyebrow">Choose Your Experience</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
            How do you want to explore VoltShare?
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Open the analytics dashboard to inspect the AML logic and backend flow, or enter the app to try the real
            Buy, Sell, Wallet, and My Activity experience.
          </p>
        </section>

        <Link
          to="/analytics"
          className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)] transition hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-fit rounded-[1rem] bg-emerald-50 p-2 text-emerald-800">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950">Open the dashboard</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Best for AML coursework, model logic, historical replay, database structure, and product telemetry.
              </p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-stone-400" />
          </div>
        </Link>

        <a
          href="/app"
          onClick={handleEnterApp}
          className="cursor-pointer rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)] transition hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-fit rounded-[1rem] bg-emerald-50 p-2 text-emerald-800">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950">Enter the app</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Best for a mobile-first VoltShare experience with Buy, Sell, Wallet, saved activity, and account-based
                history.
              </p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-stone-400" />
          </div>
        </a>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to main menu
          </Link>
        </div>
      </div>

      {showFirstTimeModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" />
          <div className="relative mx-4 mb-6 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_32px_80px_rgba(16,24,20,0.28)] sm:mb-0">
            <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-emerald-100 bg-emerald-50">
              <Sparkles className="h-5 w-5 text-emerald-700" />
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-stone-950">Is this your first time?</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              We can guide you through the real product flow: add surplus, get an AI price, publish a listing, explore
              Buy, and use Wallet credits if your balance is low.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLaunchOnboarding}
                className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                Yes, guide me
              </button>
              <button
                type="button"
                onClick={handleSkipOnboarding}
                className="rounded-[1.2rem] py-3 text-sm text-stone-500 transition hover:text-stone-800"
              >
                No, I&apos;ll explore myself
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
