import { ArrowLeft, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const ONBOARDING_START_KEY = 'voltshare-guided-onboarding-start';

export default function ExperienceHub() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Show modal immediately on mount
    const timer = setTimeout(() => setShowModal(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleLaunchOnboarding = () => {
    try {
      window.sessionStorage.setItem(ONBOARDING_START_KEY, '1');
      window.localStorage.removeItem('voltshare-guided-onboarding-v1');
    } catch {
      // ignore storage failures
    }
    setShowModal(false);
    void navigate('/app');
  };

  const handleSkipOnboarding = () => {
    try {
      window.sessionStorage.removeItem(ONBOARDING_START_KEY);
    } catch {
      // ignore storage failures
    }
    setShowModal(false);
    void navigate('/app');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto w-full max-w-md pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" />
          <div className="relative mx-4 mb-6 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_32px_80px_rgba(16,24,20,0.28)] sm:mb-0">
            <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-emerald-100 bg-emerald-50">
              <Sparkles className="h-5 w-5 text-emerald-700" />
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-stone-950">Is this your first time?</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              We can guide you through the product flow: add surplus energy, get an ML-optimised price, publish a listing, explore Buy, and use Wallet credits.
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
