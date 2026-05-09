import { Activity, House, ShoppingBag, Sparkles, Wallet } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import OnboardingModal from '@/components/OnboardingModal';

const tabs = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/market', label: 'Market', icon: ShoppingBag },
  { to: '/app/sell', label: 'Sell', icon: Sparkles },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
];

export default function AppShell() {
  const { user, profile, isFirstTime } = useAuth();

  return (
    <>
    {isFirstTime && <OnboardingModal />}
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] pb-28 pt-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col px-4">
        <header className="mb-4 rounded-[2rem] border border-white/80 bg-white/90 px-5 py-4 shadow-[0_18px_40px_rgba(38,84,62,0.10)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">VoltShare</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {user ? `Welcome back${profile?.display_name ? `, ${profile.display_name}` : ''}` : 'Trade local clean energy'}
              </h1>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                {user ? profile?.email || user.email : 'Buy and sell surplus renewable energy with nearby users.'}
              </p>
            </div>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
              {user ? 'Signed in' : 'Guest'}
            </div>
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(100%-1.5rem,28rem)] rounded-[1.9rem] border border-stone-200/90 bg-white/95 px-2 py-2 shadow-[0_18px_50px_rgba(38,84,62,0.16)] backdrop-blur">
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-[1.3rem] px-2 py-2 text-[11px] font-medium transition ${
                    isActive
                      ? 'bg-emerald-950 text-white shadow-[0_10px_20px_rgba(16,24,20,0.18)]'
                      : 'text-stone-500 hover:bg-emerald-50 hover:text-emerald-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </main>
    </>
  );
}
