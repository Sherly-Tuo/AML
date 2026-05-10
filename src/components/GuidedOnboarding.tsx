import { CheckCircle2, MousePointer2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useStore } from '@/store';

const STORAGE_KEY = 'voltshare-guided-onboarding-v1';
const START_KEY = 'voltshare-guided-onboarding-start';

type OnboardingStep = {
  id: string;
  route: string;
  targetId: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  mode?: 'action' | 'info';
  waitFor?: 'recommendation' | 'listing';
  waitMessage?: string;
};

const steps: OnboardingStep[] = [
  {
    id: 'home-setup',
    route: '/app',
    targetId: 'home-sell-cta',
    eyebrow: 'Step 1',
    title: 'Start by adding your surplus',
    body: 'This is your first action in VoltShare. Set how much extra energy you can sell today.',
    cta: 'Go to Sell',
    mode: 'action',
  },
  {
    id: 'sell-form',
    route: '/app/sell',
    targetId: 'sell-form-fields',
    eyebrow: 'Step 2',
    title: 'Enter your energy and target hour',
    body: 'Fill in your surplus and listing time. VoltShare will use these inputs to estimate a stronger local asking price.',
    cta: 'Next',
  },
  {
    id: 'sell-recommendation',
    route: '/app/sell',
    targetId: 'sell-generate',
    eyebrow: 'Step 3',
    title: 'Generate your AI price',
    body: 'Tap Get recommendation. When the pricing card appears, VoltShare has calculated your AI suggested listing price and expected earnings.',
    cta: 'Continue',
    mode: 'action',
    waitFor: 'recommendation',
    waitMessage: 'Run the recommendation first to unlock the next step.',
  },
  {
    id: 'sell-confirm',
    route: '/app/sell',
    targetId: 'sell-confirm',
    eyebrow: 'Step 4',
    title: 'Publish your first listing',
    body: 'Confirm listing to send your surplus into the shared marketplace, where other users can view and buy it.',
    cta: 'Listing published',
    mode: 'action',
    waitFor: 'listing',
    waitMessage: 'Confirm your listing first so it can appear in the marketplace.',
  },
  {
    id: 'activity',
    route: '/app/activity',
    targetId: 'activity-screen',
    eyebrow: 'Step 5',
    title: 'My Activity keeps your history',
    body: 'Everything you generate or buy comes back here, so the same account can see the same records next time it logs in.',
    cta: 'Explore Buy',
  },
  {
    id: 'buy',
    route: '/app/market',
    targetId: 'buy-first-listing',
    eyebrow: 'Step 6',
    title: 'Browse and buy local energy',
    body: 'This is the shared marketplace. If your wallet balance is too low, VoltShare will send you to Wallet so you can redeem credits or top up.',
    cta: 'Open Wallet',
  },
  {
    id: 'wallet',
    route: '/app/wallet',
    targetId: 'wallet-credits',
    eyebrow: 'Step 7',
    title: 'Redeem credits and manage balance',
    body: 'Use Wallet to redeem AGRADEPROJECT or top up your balance. This is where VoltShare stores credits, wallet activity, and profile tools.',
    cta: 'Finish',
  },
];

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function GuidedOnboarding() {
  const { user, markOnboarded } = useAuth();
  const appEvents = useStore((state) => state.appEvents);
  const navigate = useNavigate();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isActionStep = current.mode === 'action';

  const hasRecommendation = useMemo(
    () => appEvents.some((event) => event.eventName === 'generate_recommendation'),
    [appEvents],
  );
  const hasListing = useMemo(
    () => appEvents.some((event) => event.eventName === 'confirm_listing'),
    [appEvents],
  );

  const canAdvance = current.waitFor === 'recommendation'
    ? hasRecommendation
    : current.waitFor === 'listing'
      ? hasListing
      : true;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'done') {
        setIsReady(true);
        setIsVisible(false);
        return;
      }

      const shouldStart = window.sessionStorage.getItem(START_KEY);
      if (shouldStart !== '1') {
        setIsReady(true);
        setIsVisible(false);
        return;
      }

      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < steps.length) {
        setStepIndex(parsed);
      }

      setIsVisible(true);
      setIsReady(true);
    } catch {
      setIsVisible(true);
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isVisible || !isReady) {
      return;
    }

    if (location.pathname !== current.route) {
      navigate(current.route);
    }
  }, [current.route, isReady, isVisible, location.pathname, navigate]);

  useEffect(() => {
    if (!isVisible || !isReady) {
      return;
    }

    let frame = 0;
    let timeout = 0;

    const measureRect = () => {
      const target = document.querySelector<HTMLElement>(`[data-onboarding-id="${current.targetId}"]`);
      if (!target) {
        setRect(null);
        return;
      }

      const bounds = target.getBoundingClientRect();
      setRect({
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      });
    };

    const bringIntoView = () => {
      const target = document.querySelector<HTMLElement>(`[data-onboarding-id="${current.targetId}"]`);
      if (!target) {
        setRect(null);
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

      timeout = window.setTimeout(() => {
        measureRect();
      }, 320);
    };

    frame = window.requestAnimationFrame(bringIntoView);
    window.addEventListener('resize', measureRect);
    window.addEventListener('scroll', measureRect, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener('resize', measureRect);
      window.removeEventListener('scroll', measureRect, true);
    };
  }, [current.targetId, isReady, isVisible, location.pathname]);

  useEffect(() => {
    if (!isVisible || !isReady) {
      return;
    }

    if (current.id === 'home-setup' && location.pathname === '/app/sell') {
      const nextStep = 1;
      setStepIndex(nextStep);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(nextStep));
      } catch {
        // ignore storage failures
      }
    }
  }, [current.id, isReady, isVisible, location.pathname]);

  useEffect(() => {
    if (!isVisible || !isReady) {
      return;
    }

    if (current.id === 'sell-recommendation' && hasRecommendation) {
      const nextStep = stepIndex + 1;
      if (nextStep < steps.length) {
        const timeout = window.setTimeout(() => {
          setStepIndex(nextStep);
          try {
            window.localStorage.setItem(STORAGE_KEY, String(nextStep));
          } catch {
            // ignore storage failures
          }
        }, 500);

        return () => window.clearTimeout(timeout);
      }
    }

    if (current.id === 'sell-confirm' && hasListing) {
      const nextStep = stepIndex + 1;
      if (nextStep < steps.length) {
        const timeout = window.setTimeout(() => {
          setStepIndex(nextStep);
          try {
            window.localStorage.setItem(STORAGE_KEY, String(nextStep));
          } catch {
            // ignore storage failures
          }
        }, 500);

        return () => window.clearTimeout(timeout);
      }
    }
  }, [current.id, hasListing, hasRecommendation, isReady, isVisible, stepIndex]);

  const cardStyle = useMemo(() => {
    if (!rect) {
      return {
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        width: Math.min(window.innerWidth - 24, 340),
      };
    }

    const cardWidth = Math.min(window.innerWidth - 24, 320);
    const showBelow = rect.top < window.innerHeight * 0.45;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - cardWidth / 2),
      window.innerWidth - cardWidth - 12,
    );

    const top = showBelow
      ? Math.min(window.innerHeight - 220, rect.top + rect.height + 18)
      : Math.max(12, rect.top - 212);

    return {
      left,
      top,
      width: cardWidth,
    };
  }, [rect]);

  const handleSkip = async () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'done');
      window.sessionStorage.removeItem(START_KEY);
    } catch {
      // ignore storage failures
    }
    setIsVisible(false);
    if (user) {
      await markOnboarded();
    }
  };

  const handleNext = async () => {
    if (!canAdvance) {
      return;
    }

    if (isLast) {
      await handleSkip();
      return;
    }

    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextStep));
    } catch {
      // ignore storage failures
    }
  };

  if (!isReady || !isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-stone-950/50" />

      {rect ? (
        <>
          <div
            className="absolute rounded-[1.7rem] border-2 border-emerald-300/95 bg-transparent shadow-[0_0_0_9999px_rgba(17,24,39,0.50)] transition-all duration-300"
            style={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
            }}
          />
          <div
            className="absolute rounded-[1.7rem] border border-emerald-200/60 animate-pulse"
            style={{
              top: rect.top - 14,
              left: rect.left - 14,
              width: rect.width + 28,
              height: rect.height + 28,
            }}
          />
          <div
            className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-900 shadow-[0_10px_24px_rgba(16,24,20,0.18)]"
            style={{
              top: Math.max(8, rect.top - 14),
              left: Math.min(window.innerWidth - 40, rect.left + rect.width - 16),
            }}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-200/70" />
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-white">
                <MousePointer2 className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </>
      ) : null}

      <div
        className="pointer-events-auto absolute rounded-[1.8rem] border border-white bg-white p-5 shadow-[0_32px_80px_rgba(16,24,20,0.36)] transition-all duration-300"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-emerald-100 bg-emerald-50">
              <Sparkles className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {current.eyebrow}
              </p>
              <p className="text-sm font-medium text-stone-600">
                {stepIndex + 1} / {steps.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSkip()}
            className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
          >
            Skip
          </button>
        </div>

        <h2 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-stone-950">
          {current.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-700">{current.body}</p>

        {!canAdvance && current.waitMessage ? (
          <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
            {current.waitMessage}
          </div>
        ) : null}

        {isActionStep ? (
          <div className="mt-5 rounded-[1rem] border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
            Tap the highlighted action to continue.
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canAdvance}
              className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,24,20,0.18)] transition hover:bg-emerald-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
            >
              {isLast ? <CheckCircle2 className="h-4 w-4" /> : null}
              {current.cta}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
