import { useState, useEffect, useCallback } from "react";
import { Clock, ExternalLink, Calendar, MapPin, Store as StoreIcon, Package, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, LayoutGrid, Database, Layers, Heart, Bell, Store, Activity, Plus, Search, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { API_BASE_URL } from "../config";

interface Lottery {
    id: string;
    product: {
        productName: string;
        franchise: string;
        tcgCategory?: { name: string };
    };
    store: { storeName: string; region: string };
    set?: { setName: string };
    status: string;
    applicationStart: string | null;
    applicationEnd: string | null;
    resultDate: string | null;
    purchaseStart: string | null;
    purchaseEnd: string | null;
    sourceUrl: string;
    notes: string;
    category?: string;
    inventoryStatus?: string;
    imageUrl?: string | null;
}

const CACHE_KEY = "lotteryiq_terminal_cache";
const CAT_CACHE_KEY = "lotteryiq_categories_cache";

function readCache<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > 5 * 60 * 1000) return null;
        return data as T;
    } catch { return null; }
}

function writeCache<T>(key: string, data: T) {
    try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
}

export function LotteryTerminal({ initialTerminal }: { initialTerminal?: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SALES" }) {
    const { config } = useTheme();
    const [view, setView] = useState<"TERMINALS" | "CATEGORIES" | "SETS" | "LOTTERIES">("TERMINALS");
    const [currentTerminal, setCurrentTerminal] = useState<"BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SALES" | null>(null);
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [selectedSet, setSelectedSet] = useState<any>(null);

    const [lotteries, setLotteries] = useState<Lottery[]>([]);
    const [filter, setFilter] = useState("ALL");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [recentSignals, setRecentSignals] = useState<any[]>([]);
    const [isCarouselHovered, setIsCarouselHovered] = useState(false);


    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/tcg-categories`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTcgCategories(data);
            writeCache(CAT_CACHE_KEY, data);
            setIsStale(false);
        } catch (error) {
            const cached = readCache<any[]>(CAT_CACHE_KEY);
            if (cached) {
                setTcgCategories(cached);
                setIsStale(true);
            }
            console.error("Fetch categories failed", error);
        }
    }, []);

    const fetchLotteries = useCallback(async (category?: string, set?: string, terminal?: string) => {
        setIsRefreshing(true);
        setFetchError(null);
        const cacheKey = `${CACHE_KEY}_${terminal || ""}_${category || ""}_${set || ""}`;
        try {
            let url = `${API_BASE_URL}/api/lotteries`;
            const params = new URLSearchParams();
            if (terminal) params.append("category", terminal);
            if (category) params.append("tcgCategoryId", category);
            if (set) params.append("set", set);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setLotteries(data);
            writeCache(cacheKey, data);
            setIsStale(false);
        } catch (error) {
            const cached = readCache<Lottery[]>(cacheKey);
            if (cached && cached.length > 0) {
                setLotteries(cached);
                setIsStale(true);
                setFetchError("Backend unreachable — showing cached data");
            } else {
                setFetchError("Failed to load data. Backend may be offline.");
            }
            console.error("Fetch lotteries failed", error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    const fetchRecentSignals = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/lotteries?take=10`);
            const data = await res.json();
            setRecentSignals(data);
        } catch (e) {
            console.error("Fetch recent signals failed", e);
        }
    };


    useEffect(() => {
        fetchCategories();
        fetchRecentSignals();
        if (initialTerminal) {
            selectTerminal(initialTerminal);
        }

        // Auto-refresh signals every 60s
        const interval = setInterval(fetchRecentSignals, 60000);
        return () => clearInterval(interval);
    }, [initialTerminal]);


    const selectTerminal = (terminal: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SALES") => {
        setCurrentTerminal(terminal);
        if (terminal === "TCG_LOTTERY") {
            setView("CATEGORIES");
        } else {
            setView("LOTTERIES");
            fetchLotteries(undefined, undefined, terminal);
        }
    };

    const handleCategoryClick = (cat: any) => {
        setSelectedCategory(cat);
        setView("SETS");
    };

    const handleSetClick = (set: any) => {
        setSelectedSet(set);
        setView("LOTTERIES");
        fetchLotteries(selectedCategory.id, set.id, currentTerminal!);
    };

    const resetToTerminals = () => {
        setCurrentTerminal(null);
        setSelectedCategory(null);
        setSelectedSet(null);
        setView("TERMINALS");
        setLotteries([]);
    };

    const resetToCategories = () => {
        if (!currentTerminal) return resetToTerminals();
        if (currentTerminal !== "TCG_LOTTERY") return resetToTerminals();
        setSelectedCategory(null);
        setSelectedSet(null);
        setView("CATEGORIES");
    };

    const resetToSets = () => {
        setSelectedSet(null);
        setView("SETS");
    };

    const filtered = lotteries.filter(l => {
        if (filter === "ALL") return true;
        return l.status === filter;
    });

    const terminals = [
        { id: "TCG_LOTTERY", label: "TCG Lotteries", icon: Database, color: "text-indigo-400", bg: "bg-indigo-400/10" },
        { id: "BONBON", label: "Bonbon Lotteries", icon: LayoutGrid, color: "text-rose-400", bg: "bg-rose-400/10" },
        { id: "TCG_RESTOCK", label: "TCG Restocks", icon: RefreshCw, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        { id: "SALES", label: "Sales Info", icon: Package, color: "text-amber-400", bg: "bg-amber-400/10" },
    ] as const;

    return (
        <div className="space-y-8">
            {/* Global System Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e0e11] border border-brand-border p-3 md:p-4 rounded-xl shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-indigo-500/[0.02] pointer-events-none" />
                
                <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth relative z-10">
                    {!initialTerminal && (
                        <button 
                            onClick={resetToTerminals}
                            className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${view === "TERMINALS" ? "bg-brand-accent/20 border-brand-accent text-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>System_Home</span>
                        </button>
                    )}
                    {currentTerminal && (
                        <>
                            {!initialTerminal && <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
                            <button 
                                onClick={resetToCategories}
                                disabled={!!initialTerminal && currentTerminal !== "TCG_LOTTERY"}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${view === "CATEGORIES" ? "bg-brand-accent/20 border-brand-accent text-brand-accent" : (!!initialTerminal && currentTerminal !== "TCG_LOTTERY") ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent cursor-default" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                            >
                                {currentTerminal === "TCG_LOTTERY" ? (
                                    <>
                                        <Database className="w-3.5 h-3.5" />
                                        <span>TCG_Primary</span>
                                    </>
                                ) : (
                                    <>
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>Node_{currentTerminal.split('_')[0]}</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {selectedCategory && (
                        <>
                            <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />
                            <button 
                                onClick={resetToSets}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${view === "SETS" ? "bg-brand-accent/20 border-brand-accent text-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                            >
                                <Database className="w-3.5 h-3.5" />
                                <span>{selectedCategory.name.toUpperCase()}</span>
                            </button>
                        </>
                    )}
                    {selectedSet && (
                        <>
                            <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />
                            <div className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 text-[10px] md:text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-2 shrink-0">
                                <Layers className="w-3.5 h-3.5" />
                                <span>{selectedSet.setName}</span>
                            </div>
                        </>
                    )}
                </div>

                {isStale && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[9px] font-mono text-amber-400 uppercase tracking-widest shrink-0">
                        <WifiOff className="w-3 h-3" />
                        <span>Cached_Data</span>
                    </div>
                )}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0 relative z-10">
                    {view === "LOTTERIES" && (
                        <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-brand-border overflow-x-auto no-scrollbar">
                            {["ALL", "ACTIVE", "UPCOMING", "CLOSED"].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1.5 text-[8px] md:text-[9px] font-black uppercase rounded-md transition-all shrink-0 ${
                                        filter === f ? "bg-brand-accent text-white" : "text-gray-600 hover:text-gray-400"
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            if (view === "TERMINALS") fetchCategories();
                            else if (view === "CATEGORIES") fetchCategories();
                            else if (view === "SETS") fetchCategories();
                            else fetchLotteries(selectedCategory?.id, selectedSet?.id, currentTerminal!);
                        }}
                        className="p-2.5 bg-[#1a1a1c] border border-brand-border text-gray-500 hover:text-white rounded-lg transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {view === "TERMINALS" && (
                    <motion.div 
                        key="terminals"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-12"
                    >
                        {/* Status Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {terminals.map(term => (
                                <button 
                                    key={term.id}
                                    onClick={() => selectTerminal(term.id)}
                                    className="group relative aspect-[1.6/1] md:aspect-square bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden hover:border-brand-accent transition-all p-6 text-left flex flex-col justify-between shadow-xl"
                                    style={{ borderRadius: config.theme.cardRadius }}
                                >
                                    <div className={`absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${term.color}`}>
                                        <term.icon className="w-32 h-32 md:w-48 md:h-48" />
                                    </div>
                                    <div className="z-10">
                                        <div className={`w-12 h-12 ${term.bg} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-white/[0.02]`}>
                                            <term.icon className={`w-6 h-6 ${term.color}`} />
                                        </div>
                                        <h3 className="text-xl font-black text-white font-mono uppercase tracking-tighter mb-1">{term.label}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
                                            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Feed_Live • v4.2</span>
                                        </div>
                                    </div>
                                    <div className={`z-10 flex items-center gap-2 font-bold text-[9px] uppercase tracking-widest transition-transform group-hover:translate-x-2 ${term.color}`}>
                                        <span>Deploy Terminal</span>
                                        <ChevronRight className="w-3 h-3" />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Recent Signal Feed */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                    <Activity className="w-4 h-4 text-indigo-500" />
                                    <span>Recent Global Intelligence Signals</span>
                                </h2>
                                <div className="text-[9px] text-gray-600 font-mono italic flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    LIVE_FEED_CONNECTED
                                </div>
                            </div>

                            <div 
                                className="relative overflow-hidden group"
                                onMouseEnter={() => setIsCarouselHovered(true)}
                                onMouseLeave={() => setIsCarouselHovered(false)}
                            >
                                {recentSignals.length === 0 ? (
                                    <div className="bg-black/20 border border-brand-border border-dashed rounded-3xl p-12 flex flex-col items-center justify-center space-y-4">
                                        <Search className="w-8 h-8 text-gray-800 animate-bounce" />
                                        <div className="text-[9px] text-gray-600 font-mono uppercase tracking-[0.4em] text-center">Awaiting incoming intelligence signals...</div>
                                    </div>
                                ) : (
                                    <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
                                        <AnimatePresence mode="popLayout">
                                            {recentSignals.map((signal, idx) => (
                                                <motion.div
                                                    key={signal.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="flex-shrink-0 w-72 bg-gradient-to-br from-[#121215] to-[#0e0e11] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden group/card hover:border-brand-accent/30 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]"
                                                >
                                                    <div className="absolute -top-4 -right-4 opacity-[0.02] group-hover/card:opacity-[0.05] transition-opacity">
                                                        <Activity className="w-20 h-20" />
                                                    </div>
                                                    
                                                    {signal.imageUrl && (
                                                        <div className="relative -mx-5 -mt-5 mb-4 overflow-hidden h-24">
                                                            <img 
                                                                src={signal.imageUrl} 
                                                                alt={signal.product?.productName} 
                                                                className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-[#121215] to-transparent" />
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                                            signal.category === 'BONBON' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                            signal.category === 'TCG_RESTOCK' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                        }`}>
                                                            {signal.category?.replace('TCG_', '')}
                                                        </div>
                                                        <div className="text-[8px] text-gray-600 font-mono">{new Date(signal.updatedAt).toLocaleDateString()}</div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="text-[8px] text-gray-500 font-mono uppercase mb-1">Source_Node</div>
                                                            <div className="text-xs font-bold text-white truncate group-hover/card:text-brand-accent transition-colors">
                                                                {signal.product?.productName}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                                                                <Store className="w-3.5 h-3.5 text-gray-500" />
                                                            </div>
                                                            <div>
                                                                <div className="text-[7px] text-gray-600 font-mono uppercase">Origin_Store</div>
                                                                <div className="text-[9px] font-black text-gray-300 uppercase">{signal.store?.storeName}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 pt-3 border-t border-white/[0.03] flex justify-between items-center">
                                                        <div className={`text-[8px] font-black uppercase tracking-widest ${
                                                            signal.status === 'ACTIVE' ? 'text-emerald-400' : 
                                                            signal.status === 'UPCOMING' ? 'text-indigo-400' : 'text-rose-500'
                                                        }`}>
                                                            Status::{signal.status}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-brand-accent shadow-[0_0_8px_rgba(99,102,241,1)] animate-pulse" />
                                                            <span className="text-[7px] text-gray-600 font-mono uppercase tracking-widest">Active_Link</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Categories Rapid Access */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                    <Database className="w-4 h-4 text-indigo-400" />
                                    <span>Active Index Nodes</span>
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {tcgCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setCurrentTerminal("TCG_LOTTERY");
                                            handleCategoryClick(cat);
                                        }}
                                        className="p-4 bg-[#0e0e11] border border-brand-border rounded-xl hover:border-brand-accent transition-all text-left group"
                                    >
                                        <div className="text-[8px] text-gray-600 font-bold uppercase mb-1 group-hover:text-brand-accent transition-colors">Category</div>
                                        <div className="text-xs font-black text-white uppercase truncate">{cat.name}</div>
                                    </button>
                                ))}
                                <button
                                    onClick={() => selectTerminal("TCG_LOTTERY")}
                                    className="p-4 bg-black/40 border border-brand-border border-dashed rounded-xl hover:border-gray-500 transition-all text-center flex flex-col items-center justify-center gap-1"
                                >
                                    <Plus className="w-4 h-4 text-gray-700" />
                                    <span className="text-[8px] text-gray-700 font-bold uppercase">All Nodes</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {view === "CATEGORIES" && (
                    <motion.div 
                        key="categories"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {tcgCategories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat)}
                                className="group relative aspect-square bg-[#0e0e11] border border-brand-border rounded-2xl overflow-hidden hover:border-indigo-500 transition-all p-6 text-left flex flex-col justify-between shadow-xl"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Database className="w-24 h-24 text-white" />
                                </div>
                                <div className="z-10">
                                    <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                                        <Database className="w-6 h-6 text-indigo-400 group-hover:text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2 font-mono uppercase tracking-tighter">{cat.name}</h3>
                                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{cat.sets?.length || 0} Sets Loaded</div>
                                </div>
                                <div className="z-10 flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                                    <span>Explorer Database</span>
                                    <ChevronRight className="w-3 h-3" />
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}

                {view === "SETS" && (
                    <motion.div 
                        key="sets"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {selectedCategory?.sets?.map((set: any) => (
                            <button 
                                key={set.id}
                                onClick={() => handleSetClick(set)}
                                className="bg-[#0e0e11] border border-brand-border rounded-xl p-4 flex items-center justify-between hover:border-brand-success/50 hover:bg-white/[0.02] transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-brand-success/10 rounded-lg flex items-center justify-center text-brand-success">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-white uppercase font-mono">{set.setName}</div>
                                        <div className="text-[10px] text-gray-500 font-mono">Released: {set.releaseDate ? new Date(set.releaseDate).toLocaleDateString() : "Historical"}</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-success transition-colors" />
                            </button>
                        ))}
                    </motion.div>
                )}

                {view === "LOTTERIES" && (
                    <motion.div
                        key="lotteries"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        {fetchError && !isStale && (
                            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{fetchError}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filtered.map((lottery) => (
                                <LotteryCard key={lottery.id} lottery={lottery} />
                            ))}
                            {filtered.length === 0 && !fetchError && (
                                <div className="col-span-full py-20 text-center space-y-4">
                                    <div className="w-16 h-16 bg-[#1a1a1c] rounded-full flex items-center justify-center mx-auto text-gray-700">
                                        <AlertCircle className="w-8 h-8" />
                                    </div>
                                    <div className="text-gray-500 font-mono text-xs uppercase tracking-widest">No active lotteries found for this set.</div>
                                    <button 
                                        onClick={resetToSets}
                                        className="text-indigo-400 font-bold text-[10px] uppercase hover:underline"
                                    >
                                        Return to Sets
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function LotteryCard({ lottery }: { lottery: Lottery; key?: string }) {
    const { config } = useTheme();
    const isEndingSoon = lottery.applicationEnd && new Date(lottery.applicationEnd).getTime() - Date.now() < 86400000;
    const isBonbon = (lottery as any).category === "BONBON";
    const isRestock = (lottery as any).category === "TCG_RESTOCK";
    const isSale = (lottery as any).category === "SALES";

    const cardStyles = isBonbon 
        ? { borderRadius: "2rem" } 
        : { borderRadius: config.theme.cardRadius };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group relative overflow-hidden transition-all duration-500 border flex flex-col h-full shadow-2xl ${
                isBonbon 
                ? "bg-rose-950/20 border-rose-500/30 p-6 hover:border-rose-400 shadow-rose-900/10" 
                : "bg-[#0e0e11] border-brand-border p-5 hover:border-brand-accent/50 shadow-black/50"
            }`}
            style={cardStyles}
        >
            {/* Terminal Background Layer */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
            </div>

            {isBonbon && (
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <LayoutGrid className="w-24 h-24 text-rose-500 rotate-12" />
                </div>
            )}
            
            {lottery.imageUrl && (
                <div className="relative -mx-5 -mt-5 mb-4 overflow-hidden h-40">
                    <img 
                        src={lottery.imageUrl} 
                        alt={lottery.product?.productName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e11] to-transparent" />
                </div>
            )}

            <div className="flex-grow space-y-4 relative z-10">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            {lottery.status === "ACTIVE" ? (
                                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border tracking-tighter ${
                                    isBonbon ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-[#1e2a1e] text-[#00ff9d] border-[#2d4d2d]"
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-rose-400" : "bg-[#00ff9d]"}`} />
                                    <span>ACTIVE</span>
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-[#1a1a1c] text-gray-500 text-[9px] font-bold border border-brand-border">
                                    {lottery.status}
                                </span>
                            )}
                            {(lottery as any).category && (lottery as any).category !== "TCG_LOTTERY" && (
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest ${
                                    isBonbon ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                }`}>
                                    {(lottery as any).category.replace("_", " ")}
                                </span>
                            )}
                        </div>
                        <div className="text-[7px] text-gray-700 font-mono uppercase tracking-[0.2em]">UID_{lottery.id.slice(0, 8)}</div>
                    </div>
                    {isEndingSoon && (
                        <div className="p-1 rounded-full bg-rose-500/20 text-rose-500 animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isBonbon ? "text-rose-400/60" : isSale ? "text-emerald-400/60" : "text-indigo-400/60"}`}>
                        {isBonbon ? <Heart className="w-3 h-3" /> : isSale ? <StoreIcon className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                        <span>{isSale ? "DEALER CENTER" : (lottery.product.franchise || (isBonbon ? "BONBON" : "TCG"))}</span>
                    </div>
                    <h3 className={`font-black tracking-tight line-clamp-2 leading-tight uppercase font-mono ${
                        isBonbon ? "text-lg text-rose-100 group-hover:text-white" : isSale ? "text-lg text-emerald-100" : "text-sm text-white group-hover:text-indigo-400 transition-colors"
                    }`}>
                        {isSale ? lottery.store.storeName : lottery.product.productName}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest overflow-hidden text-ellipsis whitespace-nowrap">
                        {isSale ? lottery.product.productName : `${lottery.product.tcgCategory?.name} ${lottery.set?.setName && `• ${lottery.set.setName}`}`}
                    </p>
                </div>

                {/* Metadata Layers section restored */}
                <div className={`pt-4 space-y-2.5 font-mono border-t ${isBonbon ? "border-rose-500/20" : "border-brand-border"}`}>
                    <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2 text-gray-600 font-bold uppercase tracking-widest">
                            <Store className="w-3.5 h-3.5" />
                            <span>Node_Loc</span>
                        </div>
                        <span className={`font-black ${isBonbon ? "text-rose-300" : "text-white"}`}>{lottery.store.storeName}</span>
                    </div>

                    {(isSale || isRestock) ? (
                        <div className="space-y-2">
                             <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2 text-gray-600 font-bold uppercase tracking-widest">
                                    <Activity className="w-3.5 h-3.5" />
                                    <span>Inventory</span>
                                </div>
                                <span className={`font-black tracking-widest px-2 py-0.5 rounded ${
                                    (lottery as any).inventoryStatus === 'AVAILABLE' ? (isBonbon ? 'text-rose-400 bg-rose-400/10' : 'text-brand-success bg-brand-success/10') : 
                                    (lottery as any).inventoryStatus === 'UNAVAILABLE' ? 'text-rose-500 bg-rose-500/10' : 'text-gray-600'
                                }`}>
                                    {(lottery as any).inventoryStatus || 'SCANNING'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-widest">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Signal</span>
                                </div>
                                <span className="text-amber-400/80 font-black">{isRestock ? "NEW_BATCH" : "FLASH_SALE"}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {lottery.applicationEnd && (
                                <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2 text-gray-600 font-bold uppercase tracking-widest">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Deadline</span>
                                    </div>
                                    <span className={`font-black ${isEndingSoon ? "text-rose-400 underline underline-offset-4 animate-pulse" : "text-white"}`}>
                                        {new Date(lottery.applicationEnd).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {lottery.resultDate && (
                                <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2 text-gray-600 font-bold uppercase tracking-widest">
                                        <Bell className="w-3.5 h-3.5" />
                                        <span>Result_UX</span>
                                    </div>
                                    <span className="text-gray-400 font-black">{new Date(lottery.resultDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            
                            {/* Restoring the internal "Notes" layer if expanded or useful */}
                            {lottery.notes && (
                                <div className="pt-2 border-t border-white/[0.03] space-y-1">
                                    <div className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Logic_Metadata</div>
                                    <p className="text-[9px] text-gray-500 line-clamp-1 italic leading-tight">{lottery.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-brand-border/20 flex flex-col gap-2">
                <a
                    href={lottery.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center justify-center gap-2 w-full h-11 transition-all text-[10px] font-black uppercase tracking-widest ${
                        isBonbon 
                        ? "bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-900/30" 
                        : "bg-brand-accent hover:opacity-90 text-white shadow-xl shadow-brand-accent/20"
                    }`}
                    style={!isBonbon ? { borderRadius: `calc(${config.theme.cardRadius} * 0.75)` } : {}}
                >
                    <ExternalLink className="w-4 h-4" />
                    <span>{isSale || isRestock ? "ACCESS_SOURCE" : "OFFICIAL_INTEL"}</span>
                </a>
                
                {/* Secondary data source layer */}
                <div className="flex justify-center">
                    <span className="text-[7px] text-gray-800 font-mono uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
                        REF_ID: CMS-{lottery.id.slice(-4).toUpperCase()}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
