import { Activity, ArrowLeft, House, ShoppingBag, Sparkles, Wallet } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import GuidedOnboarding from '@/components/GuidedOnboarding';

const tabs = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/market', label: 'Buy', icon: ShoppingBag },
  { to: '/app/sell', label: 'Sell', icon: Sparkles },
  { to: '/app/activity', label: 'My Activity', icon: Activity },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
];

export default function AppShell() {
  const location = useLocation();
  const showBack = location.pathname === '/app';

  return (
    <>
    <GuidedOnboarding />
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] pb-28 pt-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col px-4">
        {showBack ? (
          <div className="mb-3">
            <Link
              to="/experience"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        ) : null}
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
