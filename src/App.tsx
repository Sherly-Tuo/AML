import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ActivityScreen from "@/pages/ActivityScreen";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";
import Auth from "@/pages/Auth";
import ExperienceHub from "@/pages/ExperienceHub";
import Intro from "@/pages/Intro";
import MobileHome from "@/pages/MobileHome";
import Marketplace from "@/pages/Marketplace";
import SellEnergy from "@/pages/SellEnergy";
import WalletScreen from "@/pages/WalletScreen";

export default function App() {
  const pathnameBase = new URL(document.baseURI).pathname.replace(/\/$/, "");
  const basename = pathnameBase.length > 0 ? pathnameBase : "/";

  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/experience" element={<ExperienceHub />} />
        <Route element={<AppShell />}>
          <Route path="/app" element={<MobileHome />} />
          <Route path="/app/market" element={<Marketplace />} />
          <Route path="/app/sell" element={<SellEnergy />} />
          <Route path="/app/activity" element={<ActivityScreen />} />
          <Route path="/app/wallet" element={<WalletScreen />} />
        </Route>
        <Route path="/auth" element={<Auth />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
