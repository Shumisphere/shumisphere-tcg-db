import { useState, useEffect, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Terminal, Database, ShieldCheck, Activity, Search, Filter, Loader2, RefreshCcw, LayoutDashboard, Settings, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { LotteryTerminal } from "./components/LotteryTerminal";
import { AdminDashboard } from "./components/AdminDashboard";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { API_BASE_URL } from "./config";

function NavLink({ to, children, active }: { to: string, children: ReactNode, active: boolean }) {
  return (
    <Link
      to={to}
      className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
        active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}

function Header() {
    const location = useLocation();
    const isAdminPath = location.pathname.startsWith("/admin");

    return (
      <header className="h-auto md:h-16 border-b border-brand-border px-4 md:px-6 py-3 md:py-0 flex flex-col md:flex-row items-center justify-between bg-brand-header sticky top-0 z-50 gap-4">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded flex items-center justify-center font-bold text-white shadow-lg">
              <span className="text-sm">S</span>
            </div>
            <h1 className="text-sm md:text-lg font-semibold tracking-tight uppercase text-white">
              Shumi<span className="text-indigo-400">sphere</span> 
            </h1>
          </Link>
        </div>

        <nav className="flex items-center gap-1 bg-[#1a1a1c]/50 p-1 rounded-lg border border-brand-border w-full md:w-auto overflow-x-auto no-scrollbar">
          <NavLink to="/" active={location.pathname === "/"}>Terminal</NavLink>
          <NavLink to="/admin" active={isAdminPath}>Pipeline</NavLink>
        </nav>

        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <div className="text-[10px] font-bold text-white uppercase leading-none">Dwain</div>
                    <div className="text-[8px] text-gray-500 font-mono uppercase tracking-widest">Administrator</div>
                </div>
            </div>
          </div>
        </div>
      </header>
    );
}

function MainLayout({ children, stats, loading, backendDown }: any) {
  const { config } = useTheme();

  return (
    <div className="min-h-screen bg-brand-bg text-[#e0e0e0] font-sans selection:bg-brand-accent/30 flex flex-col transition-colors duration-500">
      {/* Top Banner */}
      <div className="h-auto py-1 md:h-8 bg-brand-header border-b border-brand-border flex flex-wrap items-center px-4 space-x-4 md:space-x-6 overflow-hidden">
        <div className="flex items-center space-x-2 shrink-0">
          <Activity className={`w-3.5 h-3.5 ${backendDown ? "text-amber-500" : "text-brand-success"} animate-pulse`} />
          <span className={`text-[9px] font-bold uppercase tracking-widest hidden sm:inline ${backendDown ? "text-amber-500" : "text-neutral-500"}`}>
            {backendDown ? "Node_Status: Cached" : "Node_Status: Live"}
          </span>
        </div>
        <div className="flex space-x-8 md:space-x-12 whitespace-nowrap text-[9px] font-mono text-neutral-500 uppercase overflow-hidden">
          <span>Active_Lotteries: <span className="text-brand-success">{stats.activeEvents}</span></span>
          <span className="hidden sm:inline">Core_Ingestion: <span className={backendDown ? "text-amber-500" : "text-indigo-400"}>{backendDown ? "Degraded" : "Stable"}</span></span>
          <span className="hidden md:inline">Total_Events: <span className="text-brand-success">{stats.totalEvents}</span></span>
          <span>Sources: <span className="text-indigo-400">{stats.totalSources}</span></span>
        </div>
      </div>

      <Header />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 pb-24 md:pb-6">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest animate-pulse">Syncing Intelligence...</div>
            </div>
        ) : children}
      </main>

      <footer className="hidden md:flex h-8 border-t border-brand-border px-4 items-center justify-between bg-brand-header text-[9px] font-mono text-gray-600 uppercase tracking-wider">
          <div>LOC-FIRST ARCHITECTURE • WP-SYNC-READY</div>
          <div className="text-brand-success flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
            Sync Active
          </div>
      </footer>
    </div>
  );
}



const STATS_CACHE_KEY = "lotteryiq_stats";

function getCachedStats() {
  try {
    const raw = sessionStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 5 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

export default function App() {
  const [stats, setStats] = useState({ totalEvents: 0, activeEvents: 0, totalSources: 0 });
  const [loading, setLoading] = useState(true);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setBackendDown(false);
      try { sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
      const cached = getCachedStats();
      if (cached) setStats(cached);
      setBackendDown(true);
    } finally {
      setLoading(false);
    }
  };

  const appMode = import.meta.env.VITE_APP_MODE;
  const isTerminalMode = appMode === 'terminal';
  const isPipelineMode = appMode === 'pipeline';

  return (
    <ThemeProvider>
        <Router>
          <Routes>
            {/* UNIVERSAL EMBED ROUTES (No Header/Nav) */}
            <Route path="/embed" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal /></div>} />
            <Route path="/embed/tcg" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal initialTerminal="TCG_LOTTERY" /></div>} />
            <Route path="/embed/bonbon" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal initialTerminal="BONBON" /></div>} />
            <Route path="/embed/restock" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal initialTerminal="TCG_RESTOCK" /></div>} />
            <Route path="/embed/switch2" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal initialTerminal="SWITCH2" /></div>} />
            <Route path="/embed/collectibles" element={<div className="p-4 bg-transparent min-h-screen"><LotteryTerminal initialTerminal="COLLECTIBLES" /></div>} />

            {/* TERMINAL MODE (Cloudflare) */}
            {isTerminalMode && (
              <>
                <Route path="/" element={
                    <MainLayout stats={stats} loading={loading} backendDown={backendDown}>
                        <LotteryTerminal />
                    </MainLayout>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}

            {/* PIPELINE MODE (Railway) */}
            {isPipelineMode && (
              <>
                <Route path="/" element={<Navigate to="/admin" replace />} />
                <Route path="/admin" element={
                    <MainLayout stats={stats} loading={loading} backendDown={backendDown}>
                        <AdminDashboard />
                    </MainLayout>
                } />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </>
            )}

            {/* DEVELOPMENT MODE (Both visible) */}
            {!appMode && (
              <>
                <Route path="/" element={
                    <MainLayout stats={stats} loading={loading} backendDown={backendDown}>
                        <LotteryTerminal />
                    </MainLayout>
                } />
                <Route path="/admin" element={
                    <MainLayout stats={stats} loading={loading} backendDown={backendDown}>
                        <AdminDashboard />
                    </MainLayout>
                } />
              </>
            )}

            {/* Catch-all */}
            <Route path="*" element={<Navigate to={isPipelineMode ? "/admin" : "/"} replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
  );
}

