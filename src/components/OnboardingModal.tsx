import { BarChart3, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';

const steps = [
  {
    icon: Zap,
    eyebrow: 'Welcome',
    title: 'Trade energy with your neighbor.',
    body: 'VoltShare is a peer-to-peer renewable energy platform. You start by adding your surplus, then VoltShare suggests a local listing price, expected earnings, or nearby energy to buy.',
    cta: 'Show me how',
  },
  {
    icon: BarChart3,
    eyebrow: 'Mode 1 — Algorithm Dashboard',
    title: 'See the engine behind the price.',
    body: 'The Analytics Dashboard explains how VoltShare builds its recommendation from demand, supply, weather, and optimization logic. It also shows the backend schema and product telemetry — no sign-in needed.',
    cta: 'Got it',
  },
  {
    icon: Sparkles,
    eyebrow: 'Mode 2 — App',
    title: 'List, trade, and track.',
    body: 'Inside the app, Home, Buy, Sell, My Activity, and Wallet all connect to the same account. Once signed in, your runs, purchases, profile photo, and app events stay attached to your user ID.',
    cta: "Let's start",
  },
] as const;

export default function OnboardingModal() {
  const { markOnboarded } = useAuth();
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleNext = async () => {
    if (isLast) {
      setLeaving(true);
      await markOnboarded();
    } else {
      setStep((s) => s + 1);
    }
  };

  if (leaving) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative mx-4 mb-6 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/96 p-6 shadow-[0_32px_80px_rgba(16,24,20,0.22)] sm:mb-0">

        {/* Step dots */}
        <div className="mb-5 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-emerald-700'
                  : i < step
                  ? 'w-1.5 bg-emerald-300'
                  : 'w-1.5 bg-stone-200'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-emerald-50 border border-emerald-100">
          <Icon className="h-5 w-5 text-emerald-700" />
        </div>

        {/* Text */}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {current.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-stone-950">
          {current.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-600">{current.body}</p>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleNext}
            className="flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] bg-emerald-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,24,20,0.18)] transition hover:bg-emerald-900 active:scale-[0.98]"
          >
            {isLast ? <CheckCircle2 className="h-4 w-4" /> : null}
            {current.cta}
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={markOnboarded}
              className="rounded-[1.2rem] px-4 py-3 text-sm text-stone-400 transition hover:text-stone-600"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
