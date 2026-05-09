import {
  Activity,
  ArrowRight,
  BarChart3,
  Home,
  Leaf,
  Plus,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ─── Tutorial step definitions ─── */
const STEPS = [
  {
    screen: 'home' as const,
    instruction: 'Your Home screen shows your energy balance and the live market price.',
    tapLabel: 'Tap "Nearby Market" to browse listings',
    tapTarget: 'market-btn',
  },
  {
    screen: 'market' as const,
    instruction: 'Neighbours list surplus solar energy here. The algorithm prices each one in real time.',
    tapLabel: 'Tap a listing to continue',
    tapTarget: 'listing-card',
  },
  {
    screen: 'sell' as const,
    instruction: 'Have surplus? Enter your kWh and let the AI pricing engine find the optimal rate.',
    tapLabel: 'Tap "Get AI Price"',
    tapTarget: 'ai-btn',
  },
  {
    screen: 'confirm' as const,
    instruction: 'The algorithm recommends a price using demand, supply, and weather signals. Confirm to go live.',
    tapLabel: 'Tap "Confirm & List Energy"',
    tapTarget: 'confirm-btn',
  },
] as const;

type Screen = (typeof STEPS)[number]['screen'];

interface MockScreenProps {
  glow: (t: string) => string;
  dim: (t: string) => string;
  onTap: (t: string) => void;
  hint: (t: string) => React.ReactNode;
}

type Overlay = 'none' | 'first-time' | 'tutorial';

/* ─── Main page ─── */
export default function ExperienceHub() {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [step, setStep] = useState(0);

  const handleEnterApp = (e: React.MouseEvent) => {
    e.preventDefault();
    setOverlay('first-time');
  };

  const handleTap = (target: string) => {
    if (target !== STEPS[step].tapTarget) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setOverlay('none');
      void navigate('/app');
    }
  };

  const handleSkip = () => {
    setOverlay('none');
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
            Open the analytics dashboard to see the AML pricing system, or enter the app to experience VoltShare as a product.
          </p>
        </section>

        {/* Dashboard */}
        <Link
          to="/analytics"
          className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)] transition hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="rounded-[1rem] bg-emerald-50 p-2 text-emerald-800 w-fit">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950">Open the dashboard</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Best for AML coursework, model logic, historical replay, and pricing optimisation details.
              </p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-stone-400" />
          </div>
        </Link>

        {/* Enter app — triggers tutorial */}
        <a
          href="/app"
          onClick={handleEnterApp}
          className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)] transition hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="rounded-[1rem] bg-emerald-50 p-2 text-emerald-800 w-fit">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950">Enter the app</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Best for a mobile-first, user-facing VoltShare experience with Home, Market, Sell, Activity, and Wallet.
              </p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-stone-400" />
          </div>
        </a>
      </div>

      {/* First-time gate */}
      {overlay === 'first-time' && (
        <FirstTimeModal
          onYes={() => { setStep(0); setOverlay('tutorial'); }}
          onNo={() => void navigate('/app')}
        />
      )}

      {/* Interactive tutorial */}
      {overlay === 'tutorial' && (
        <TutorialOverlay step={step} onTap={handleTap} onSkip={handleSkip} />
      )}
    </main>
  );
}

/* ─── First-time gate modal ─── */
function FirstTimeModal({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" />
      <div className="relative mx-4 mb-6 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_32px_80px_rgba(16,24,20,0.28)] sm:mb-0">
        <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-emerald-50 border border-emerald-100">
          <Sparkles className="h-5 w-5 text-emerald-700" />
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-stone-950">
          Is this your first time?
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          We can walk you through a quick 4-step tour — from browsing the market to listing your energy.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onYes}
            className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Yes, show me around
          </button>
          <button
            type="button"
            onClick={onNo}
            className="rounded-[1.2rem] py-3 text-sm text-stone-500 transition hover:text-stone-800"
          >
            No, I'll explore myself
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tutorial overlay ─── */
function TutorialOverlay({
  step,
  onTap,
  onSkip,
}: {
  step: number;
  onTap: (t: string) => void;
  onSkip: () => void;
}) {
  const s = STEPS[step];

  const glow = (t: string) =>
    t === s.tapTarget
      ? 'ring-2 ring-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.10),0_0_20px_rgba(52,211,153,0.50)] cursor-pointer'
      : '';

  const dim = (t: string) =>
    t !== s.tapTarget ? 'opacity-30 pointer-events-none select-none' : '';

  const hint = (t: string) =>
    t === s.tapTarget ? <TapFinger /> : null;

  const props: MockScreenProps = { glow, dim, onTap, hint };

  const screenToTab: Record<Screen, string> = {
    home: 'home',
    market: 'market',
    sell: 'sell',
    confirm: 'sell',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1a14] px-5 py-6 gap-5 overflow-y-auto">

      {/* Progress + skip */}
      <div className="w-full max-w-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-7 bg-emerald-400'
                  : i < step
                  ? 'w-2 bg-emerald-800'
                  : 'w-2 bg-stone-700'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Instruction card */}
      <div className="w-full max-w-xs shrink-0 rounded-2xl bg-white/8 border border-white/10 px-4 py-4">
        <p className="text-[13px] leading-6 text-white font-medium">{s.instruction}</p>
        <p className="mt-2 text-xs font-semibold text-emerald-400">👆 {s.tapLabel}</p>
      </div>

      {/* Phone frame */}
      <div className="w-[270px] shrink-0 rounded-[2.2rem] bg-white border-4 border-stone-700 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_40px_80px_rgba(0,0,0,0.8)]" style={{ overflow: 'visible' }}>
        {/* Notch bar */}
        <div className="bg-stone-900 h-6 flex items-center justify-center rounded-t-[1.6rem]">
          <div className="w-16 h-1 rounded-full bg-stone-600" />
        </div>
        {/* Screen — overflow visible so the finger hint can peek below each element */}
        <div className="bg-stone-50 min-h-[360px]" style={{ overflow: 'visible' }}>
          {s.screen === 'home'    && <HomeScreen    {...props} />}
          {s.screen === 'market'  && <MarketScreen  {...props} />}
          {s.screen === 'sell'    && <SellScreen    {...props} />}
          {s.screen === 'confirm' && <ConfirmScreen {...props} />}
        </div>
        <MockBottomNav activeTab={screenToTab[s.screen]} />
      </div>

      <p className="text-[11px] text-stone-500 shrink-0 tracking-wide">
        STEP {step + 1} / {STEPS.length}
      </p>
    </div>
  );
}

/* ─── Animated tap finger ─── */
function TapFinger() {
  return (
    <>
      <style>{`
        @keyframes tap-finger {
          0%, 100% { transform: translateY(0) scale(1); }
          40%       { transform: translateY(6px) scale(0.88); }
          60%       { transform: translateY(2px) scale(0.94); }
        }
        @keyframes tap-ring {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .tap-finger { animation: tap-finger 1.1s ease-in-out infinite; }
        .tap-ring   { animation: tap-ring  1.1s ease-out infinite; }
      `}</style>
      <span
        className="tap-finger pointer-events-none select-none absolute -bottom-7 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5"
        aria-hidden="true"
      >
        <span className="relative flex items-center justify-center">
          <span className="tap-ring absolute h-5 w-5 rounded-full bg-emerald-400 opacity-70" />
          <span className="text-[22px] leading-none">👆</span>
        </span>
      </span>
    </>
  );
}

/* ─── Mock screens ─── */
function HomeScreen({ glow, dim, onTap, hint }: MockScreenProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={dim('hdr')}>
        <p className="text-[11px] text-stone-400">Good morning ☀️</p>
        <p className="text-sm font-semibold text-stone-900">Energy overview</p>
      </div>
      <div className="rounded-2xl bg-emerald-950 p-4 text-white">
        <p className="text-[10px] text-emerald-300/80 uppercase tracking-wide">Available balance</p>
        <p className="text-xl font-semibold mt-0.5">8.4 kWh</p>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[10px] text-emerald-100/60">Live · $0.18 / kWh</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTap('market-btn')}
        className={`rounded-2xl border border-emerald-200 bg-white p-4 flex items-center justify-between w-full transition-all relative overflow-visible ${glow('market-btn')}`}
      >
        <div>
          <p className="text-sm font-semibold text-stone-900 text-left">Nearby Market</p>
          <p className="text-[11px] text-stone-500 mt-0.5 text-left">3 listings available</p>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0" />
        {hint('market-btn')}
      </button>
      <div className={`rounded-2xl border border-stone-100 bg-white p-3 ${dim('rec')}`}>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Recent</p>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-800">Sold 2.1 kWh</p>
            <p className="text-[10px] text-stone-400">Yesterday · +$0.38</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketScreen({ glow, dim, onTap, hint }: MockScreenProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={dim('mkt-hdr')}>
        <p className="text-sm font-semibold text-stone-900">Nearby Market</p>
        <p className="text-[11px] text-stone-400">3 sellers within 2 km</p>
      </div>
      <button
        type="button"
        onClick={() => onTap('listing-card')}
        className={`rounded-2xl border border-emerald-200 bg-white p-4 text-left w-full transition-all relative overflow-visible ${glow('listing-card')}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">Alex K.</p>
            <p className="text-[11px] text-stone-400 mt-0.5">0.4 km · 5.0 kWh</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-emerald-700">$0.17 / kWh</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Solar ☀️</p>
          </div>
        </div>
        {hint('listing-card')}
      </button>
      <div className={`rounded-2xl border border-stone-100 bg-white p-4 ${dim('l2')}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">Maria L.</p>
            <p className="text-[11px] text-stone-400 mt-0.5">1.1 km · 2.3 kWh</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-emerald-700">$0.19 / kWh</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Solar ☀️</p>
          </div>
        </div>
      </div>
      <div className={`rounded-2xl border border-stone-100 bg-white p-4 ${dim('l3')}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">James T.</p>
            <p className="text-[11px] text-stone-400 mt-0.5">1.8 km · 8.0 kWh</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-emerald-700">$0.20 / kWh</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Solar ☀️</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellScreen({ glow, dim, onTap, hint }: MockScreenProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={dim('sell-hdr')}>
        <p className="text-sm font-semibold text-stone-900">List Energy</p>
        <p className="text-[11px] text-stone-400">Set price or use AI</p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Available to sell</p>
        <div className="flex items-baseline gap-1">
          <p className="text-xl font-semibold text-stone-900">5.0</p>
          <p className="text-sm text-stone-400">kWh</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTap('ai-btn')}
        className={`rounded-2xl bg-emerald-950 p-4 text-white text-left w-full transition-all relative overflow-visible ${glow('ai-btn')}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Get AI Price</p>
            <p className="text-[11px] text-emerald-200/70 mt-0.5">Optimal rate via algorithm</p>
          </div>
          <Sparkles className="h-5 w-5 text-emerald-300 shrink-0" />
        </div>
        {hint('ai-btn')}
      </button>
      <div className={`rounded-2xl border border-stone-100 bg-white p-4 ${dim('manual')}`}>
        <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Or set manually</p>
        <div className="flex items-baseline gap-1">
          <p className="text-sm text-stone-300">$</p>
          <p className="text-xl font-semibold text-stone-300">—</p>
          <p className="text-sm text-stone-400">/ kWh</p>
        </div>
      </div>
    </div>
  );
}

function ConfirmScreen({ glow, dim, onTap, hint }: MockScreenProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={dim('conf-hdr')}>
        <p className="text-sm font-semibold text-stone-900">Review Listing</p>
      </div>
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">AI Recommendation</p>
        <div className="flex items-baseline gap-1 mt-1">
          <p className="text-xl font-semibold text-emerald-900">$0.19</p>
          <p className="text-xs text-emerald-600">/ kWh</p>
        </div>
        <p className="text-[10px] text-emerald-600/70 mt-1">Expected revenue · ~$0.95</p>
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <p className="text-stone-400">Amount</p>
          <p className="font-medium text-stone-700">5.0 kWh</p>
        </div>
        <div className="flex justify-between text-xs">
          <p className="text-stone-400">Price</p>
          <p className="font-medium text-stone-700">$0.19 / kWh</p>
        </div>
        <div className="flex justify-between text-xs pt-2 border-t border-stone-100">
          <p className="text-stone-400">Est. total</p>
          <p className="font-semibold text-emerald-700">~$0.95</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTap('confirm-btn')}
        className={`rounded-2xl bg-emerald-950 py-4 text-white text-center text-sm font-semibold w-full transition-all relative overflow-visible ${glow('confirm-btn')}`}
      >
        Confirm & List Energy →
        {hint('confirm-btn')}
      </button>
    </div>
  );
}

/* ─── Mock bottom nav ─── */
function MockBottomNav({ activeTab }: { activeTab: string }) {
  const tabs = [
    { id: 'home',     Icon: Home,        label: 'Home'     },
    { id: 'market',   Icon: ShoppingBag, label: 'Market'   },
    { id: 'sell',     Icon: Plus,        label: 'Sell'     },
    { id: 'activity', Icon: Activity,    label: 'Activity' },
    { id: 'wallet',   Icon: Wallet,      label: 'Wallet'   },
  ] as const;

  return (
    <div className="bg-white border-t border-stone-100 px-2 py-2.5 flex justify-between">
      {tabs.map(({ id, Icon, label }) => {
        const active = id === activeTab;
        return (
          <div key={id} className="flex flex-col items-center gap-0.5 flex-1">
            <Icon className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-stone-300'}`} />
            <span className={`text-[9px] ${active ? 'text-emerald-600 font-semibold' : 'text-stone-300'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
