import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, ExternalLink, Calendar, MapPin, Store as StoreIcon, Package, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, LayoutGrid, Database, Layers, Heart, Bell, Store, Activity, Plus, Search, WifiOff, XCircle } from "lucide-react";
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

export function getLotteryLifecycleStatus(event: any): string {
    const now = Date.now();
    const appStart = event.applicationStart ? new Date(event.applicationStart).getTime() : 0;
    const appEnd = event.applicationEnd ? new Date(event.applicationEnd).getTime() : 0;

    // Real-world fallback spacing if fields are missing:
    const resultDate = event.resultDate 
        ? new Date(event.resultDate).getTime() 
        : (appEnd ? appEnd + 2 * 24 * 60 * 60 * 1000 : 0);
        
    const purStart = event.purchaseStart 
        ? new Date(event.purchaseStart).getTime() 
        : (resultDate ? resultDate + 1 * 24 * 60 * 60 * 1000 : 0);
        
    const purEnd = event.purchaseEnd 
        ? new Date(event.purchaseEnd).getTime() 
        : (purStart ? purStart + 7 * 24 * 60 * 60 * 1000 : 0);

    if (!appStart && !appEnd && !resultDate && !purStart && !purEnd) {
        return event.status || "APPLICATION_OPEN";
    }

    if (purEnd && now > purEnd) {
        return "CLOSED";
    }

    if (purStart && now >= purStart) {
        return "PURCHASE_PERIOD";
    }

    if (appEnd && now > appEnd) {
        return "WINNER_ANNOUNCEMENT";
    }

    if (appStart && now < appStart) {
        return "UPCOMING";
    }

    if (appEnd && now <= appEnd) {
        return "APPLICATION_OPEN";
    }

    return "CLOSED";
}

function getStatusPriority(status: string): number {
    switch (status) {
        case "APPLICATION_OPEN":
        case "Accepting Applications":
            return 1;
        case "WINNER_ANNOUNCEMENT":
        case "Winner Announcement":
            return 2;
        case "PURCHASE_PERIOD":
        case "Purchase Period":
        case "Purchase Deadline":
            return 3;
        case "UPCOMING":
            return 4;
        case "CLOSED":
        default:
            return 5;
    }
}

export function LotteryTerminal({ initialTerminal }: { initialTerminal?: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" }) {
    const { config } = useTheme();
    const cacheVersionRef = useRef<number>(0);
    useEffect(() => {
        cacheVersionRef.current = (config.layout as any).cacheVersion || 0;
    }, [config]);

    const [view, setView] = useState<"FEED" | "CATEGORIES" | "LOTTERIES">("FEED");
    const [currentTerminal, setCurrentTerminal] = useState<"BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" | null>(null);
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
    const [searchQuery, setSearchQuery] = useState("");


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
        const cacheKey = `${CACHE_KEY}_v${cacheVersionRef.current}_${terminal || ""}_${category || ""}_${set || ""}`;
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
            const processed = data.map((l: any) => ({
                ...l,
                status: getLotteryLifecycleStatus(l)
            }));
            setLotteries(processed);
            writeCache(cacheKey, processed);
            setIsStale(false);
        } catch (error) {
            const cached = readCache<Lottery[]>(cacheKey);
            if (cached && cached.length > 0) {
                const processed = cached.map((l: any) => ({
                    ...l,
                    status: getLotteryLifecycleStatus(l)
                }));
                setLotteries(processed);
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
            const processed = data.map((l: any) => ({
                ...l,
                status: getLotteryLifecycleStatus(l)
            }));
            setRecentSignals(processed);
        } catch (e) {
            console.error("Fetch recent signals failed", e);
        }
    };


    useEffect(() => {
        fetchCategories();
        fetchRecentSignals();
        if (initialTerminal) {
            selectTerminal(initialTerminal);
        } else {
            fetchLotteries();
        }

        // Auto-refresh signals every 60s
        const interval = setInterval(fetchRecentSignals, 60000);
        return () => clearInterval(interval);
    }, [initialTerminal, fetchLotteries]);


    const selectTerminal = (terminal: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" | "ALL") => {
        setSearchQuery("");
        if (terminal === "ALL") {
            setCurrentTerminal(null);
            setView("FEED");
            fetchLotteries();
            return;
        }
        setCurrentTerminal(terminal as any);
        if (terminal === "TCG_LOTTERY") {
            setView("CATEGORIES");
        } else {
            setView("LOTTERIES");
            fetchLotteries(undefined, undefined, terminal);
        }
    };

    const handleCategoryClick = (cat: any) => {
        setSearchQuery("");
        setSelectedCategory(cat);
        setSelectedSet(null);
        setView("LOTTERIES");
        fetchLotteries(cat.id, undefined, currentTerminal!);
    };

    const handleSetClick = (set: any) => {
        setSearchQuery("");
        setSelectedSet(set);
        fetchLotteries(selectedCategory.id, set?.id, currentTerminal!);
    };

    const resetToFeed = () => {
        setSearchQuery("");
        setCurrentTerminal(null);
        setSelectedCategory(null);
        setSelectedSet(null);
        setView("FEED");
        fetchLotteries();
    };

    const resetToCategories = () => {
        setSearchQuery("");
        if (!currentTerminal) return resetToFeed();
        if (currentTerminal !== "TCG_LOTTERY") return resetToFeed();
        setSelectedCategory(null);
        setSelectedSet(null);
        setView("CATEGORIES");
    };

    const filtered = lotteries.filter(l => {
        // 1. Status Filter
        if (view === "FEED") {
            if (l.status === "CLOSED") return false;
        } else {
            if (filter !== "ALL") {
                if (filter === "ACTIVE") {
                    if (l.status !== "APPLICATION_OPEN" && l.status !== "WINNER_ANNOUNCEMENT" && l.status !== "PURCHASE_PERIOD") {
                        return false;
                    }
                } else if (l.status !== filter) {
                    return false;
                }
            }
        }

        // 2. Search Query Filter (Store, Product Name, Set Name, Category)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const storeMatch = l.store.storeName?.toLowerCase().includes(query);
            const productMatch = l.product.productName?.toLowerCase().includes(query);
            const setMatch = l.set?.setName?.toLowerCase().includes(query);
            const franchiseMatch = l.product.franchise?.toLowerCase().includes(query);
            const categoryMatch = l.product.tcgCategory?.name?.toLowerCase().includes(query);

            return storeMatch || productMatch || setMatch || franchiseMatch || categoryMatch;
        }

        return true;
    }).sort((a, b) => {
        const priA = getStatusPriority(a.status);
        const priB = getStatusPriority(b.status);

        if (priA !== priB) {
            return priA - priB;
        }

        // Within same priority, apply detailed sorting:
        if (priA === 1) { // APPLICATION_OPEN -> nearest ending first
            const timeA = a.applicationEnd ? new Date(a.applicationEnd).getTime() : Infinity;
            const timeB = b.applicationEnd ? new Date(b.applicationEnd).getTime() : Infinity;
            return timeA - timeB;
        }

        if (priA === 2) { // WINNER_ANNOUNCEMENT -> nearest result date first
            const timeA = a.resultDate ? new Date(a.resultDate).getTime() : Infinity;
            const timeB = b.resultDate ? new Date(b.resultDate).getTime() : Infinity;
            return timeA - timeB;
        }

        if (priA === 3) { // PURCHASE_PERIOD -> nearest purchase end/deadline first
            const timeA = a.purchaseEnd ? new Date(a.purchaseEnd).getTime() : Infinity;
            const timeB = b.purchaseEnd ? new Date(b.purchaseEnd).getTime() : Infinity;
            return timeA - timeB;
        }

        if (priA === 4) { // UPCOMING -> nearest starting first
            const timeA = a.applicationStart ? new Date(a.applicationStart).getTime() : Infinity;
            const timeB = b.applicationStart ? new Date(b.applicationStart).getTime() : Infinity;
            return timeA - timeB;
        }

        if (priA === 5) { // CLOSED -> recently closed first
            const timeA = a.purchaseEnd ? new Date(a.purchaseEnd).getTime() : (a.applicationEnd ? new Date(a.applicationEnd).getTime() : 0);
            const timeB = b.purchaseEnd ? new Date(b.purchaseEnd).getTime() : (b.applicationEnd ? new Date(b.applicationEnd).getTime() : 0);
            return timeB - timeA;
        }

        return 0;
    });

    const terminals = [
        { id: "TCG_LOTTERY", label: "TCG Lotteries", icon: Database, color: "text-indigo-400", bg: "bg-indigo-400/10" },
        { id: "BONBON", label: "Bonbon Lotteries", icon: LayoutGrid, color: "text-rose-400", bg: "bg-rose-400/10" },
        { id: "TCG_RESTOCK", label: "TCG Restocks", icon: RefreshCw, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        { id: "SWITCH2", label: "Switch 2 Lotteries", icon: Package, color: "text-amber-400", bg: "bg-amber-400/10" },
    ] as const;

    return (
        <div className="space-y-8">
            {/* Global System Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e0e11] border border-brand-border p-3 md:p-4 rounded-xl shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-indigo-500/[0.02] pointer-events-none" />
                
                <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth relative z-10">
                    {!initialTerminal && (
                        <button 
                            onClick={resetToFeed}
                            className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${view === "FEED" ? "bg-brand-accent/20 border-brand-accent text-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Home</span>
                        </button>
                    )}
                    {currentTerminal && (
                        <>
                            {!initialTerminal && <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
                            <button 
                                onClick={resetToCategories}
                                disabled={!!initialTerminal && currentTerminal !== "TCG_LOTTERY"}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 border ${view === "CATEGORIES" ? "bg-brand-accent/20 border-brand-accent text-brand-accent" : (!!initialTerminal && currentTerminal !== "TCG_LOTTERY") ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent cursor-default" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                            >
                                {currentTerminal === "TCG_LOTTERY" ? (
                                    <>
                                        <Database className="w-3.5 h-3.5" />
                                        <span>TCG</span>
                                    </>
                                ) : currentTerminal === "TCG_RESTOCK" ? (
                                    <>
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>Restocks</span>
                                    </>
                                ) : (
                                    <>
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>{currentTerminal.replace('_', ' ')}</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {selectedCategory && (
                        <>
                            <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />
                            <div className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2 shrink-0">
                                <Database className="w-3.5 h-3.5" />
                                <span>{selectedCategory.name}</span>
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 w-full md:w-auto mt-2 md:mt-0 relative z-10">
                    {(view === "FEED" || view === "LOTTERIES") && (
                        <div className="relative w-full sm:w-60 flex items-center shrink-0">
                            <Search className="absolute left-3 w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search store, set..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-1.5 bg-black border border-brand-border rounded-lg text-[11px] font-bold text-white placeholder-gray-600 focus:outline-none focus:border-brand-accent/50 transition-colors uppercase font-mono tracking-wider"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery("")} 
                                    className="absolute right-2.5 text-gray-500 hover:text-white"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                    {view === "LOTTERIES" && (
                        <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-brand-border overflow-x-auto no-scrollbar shrink-0">
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
                            if (view === "FEED") fetchLotteries();
                            else if (view === "CATEGORIES") fetchCategories();
                            else fetchLotteries(selectedCategory?.id, selectedSet?.id, currentTerminal!);
                        }}
                        className="p-2.5 bg-[#1a1a1c] border border-brand-border text-gray-500 hover:text-white rounded-lg transition-all shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {view === "FEED" && (
                    <motion.div 
                        key="feed"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-6"
                    >
                        {/* Feed Filter Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                            <button
                                onClick={() => selectTerminal("ALL")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shrink-0 border ${!currentTerminal ? "bg-brand-accent text-white border-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white hover:bg-white/[0.05]"}`}
                            >
                                Everything
                            </button>
                            {terminals.map(term => (
                                <button
                                    key={term.id}
                                    onClick={() => selectTerminal(term.id as any)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shrink-0 border ${currentTerminal === term.id ? `${term.bg} ${term.color} border-current` : "bg-black/40 border-brand-border text-gray-500 hover:text-white hover:bg-white/[0.05]"}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <term.icon className="w-4 h-4" />
                                        <span>{term.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {fetchError && !isStale && (
                            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
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
                                    <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">No active lotteries found.</div>
                                </div>
                            )}
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
                                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">{cat.name}</h3>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{cat.sets?.length || 0} Sets Available</div>
                                </div>
                                <div className="z-10 flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                                    <span>View Database</span>
                                    <ChevronRight className="w-3 h-3" />
                                </div>
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
                            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{fetchError}</span>
                            </div>
                        )}
                        
                        {/* Sub-Set Filter Pills */}
                        {selectedCategory?.sets && selectedCategory.sets.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                                <button
                                    onClick={() => handleSetClick(null)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${!selectedSet ? "bg-brand-accent text-white border-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                                >
                                    All Sets
                                </button>
                                {selectedCategory.sets.map((set: any) => (
                                    <button
                                        key={set.id}
                                        onClick={() => handleSetClick(set)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${selectedSet?.id === set.id ? "bg-brand-accent text-white border-brand-accent" : "bg-black/40 border-brand-border text-gray-500 hover:text-white"}`}
                                    >
                                        {set.setName}
                                    </button>
                                ))}
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
                                    <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">No active lotteries found for this selection.</div>
                                    <button 
                                        onClick={resetToCategories}
                                        className="text-indigo-400 font-bold text-[10px] uppercase hover:underline"
                                    >
                                        Return to Categories
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
    const [open, setOpen] = useState(false);
    const isEndingSoon = lottery.applicationEnd && new Date(lottery.applicationEnd).getTime() - Date.now() < 86400000;
    const isBonbon = (lottery as any).category === "BONBON";
    const isRestock = (lottery as any).category === "TCG_RESTOCK";
    const isSale = (lottery as any).category === "SWITCH2";
    const cardStyles = isBonbon ? { borderRadius: "2rem" } : { borderRadius: config.theme.cardRadius };
    const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : null;

    const Badge = () => {
        const s = lottery.status;
        if (s === "APPLICATION_OPEN" || s === "Accepting Applications") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-[#1e2a1e] text-[#00ff9d] border-[#2d4d2d]"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-rose-400" : "bg-[#00ff9d]"}`} />
                    ACCEPTING APPLICATIONS
                </span>
            );
        }
        if (s === "WINNER_ANNOUNCEMENT" || s === "Winner Announcement") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : "bg-indigo-950/40 text-indigo-300 border-indigo-500/30"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-pink-400" : "bg-[#6366f1]"}`} />
                    WINNER ANNOUNCEMENT
                </span>
            );
        }
        if (s === "Purchase Deadline") {
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border bg-rose-950/40 text-rose-400 border-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    PURCHASE DEADLINE
                </span>
            );
        }
        if (s === "PURCHASE_PERIOD" || s === "Purchase Period") {
            const isUrgent = lottery.purchaseEnd && (new Date(lottery.purchaseEnd).getTime() - Date.now() < 86400000);
            if (isUrgent) {
                return (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border bg-rose-950/40 text-rose-400 border-rose-500/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        PURCHASE DEADLINE
                    </span>
                );
            }
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-950/40 text-amber-300 border-amber-500/30"}`}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-amber-400" />
                    PURCHASE PERIOD
                </span>
            );
        }
        if (s === "UPCOMING") {
            return (
                <span className="px-2 py-0.5 rounded-full bg-blue-950/30 text-blue-400 text-[9px] font-bold border border-blue-500/20">
                    UPCOMING
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full bg-[#1a1a1c] text-gray-500 text-[9px] font-bold border border-brand-border">
                {s === "CLOSED" ? "CLOSED" : s}
            </span>
        );
    };

    return (
        <>
            {/* Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setOpen(true)}
                className={`group relative overflow-hidden transition-all duration-300 border flex flex-col h-full shadow-2xl cursor-pointer ${isBonbon ? "bg-rose-950/20 border-rose-500/30 p-6 hover:border-rose-400" : "bg-[#0e0e11] border-brand-border p-5 hover:border-brand-accent/50"}`}
                style={cardStyles}
            >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity">
                    <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
                </div>
                {lottery.imageUrl && (
                    <div className="relative -mx-5 -mt-5 mb-4 overflow-hidden h-40">
                        <img src={lottery.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e11] to-transparent" />
                    </div>
                )}
                <div className="flex-grow space-y-3 relative z-10">
                    <div className="flex justify-between items-center">
                        <Badge />
                        {isEndingSoon && <div className="p-1 rounded-full bg-rose-500/20 text-rose-500 animate-pulse"><Clock className="w-3.5 h-3.5" /></div>}
                    </div>
                    <div>
                        <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isBonbon ? "text-rose-400/60" : isSale ? "text-emerald-400/60" : "text-indigo-400/60"}`}>
                            {isSale ? "DEALER CENTER" : lottery.product.franchise || (isBonbon ? "BONBON" : "TCG")}
                        </div>
                        <h3 className={`font-black tracking-tight line-clamp-2 leading-tight uppercase font-mono ${isBonbon ? "text-lg text-rose-100" : isSale ? "text-lg text-emerald-100" : "text-sm text-white group-hover:text-indigo-400 transition-colors"}`}>
                            {isSale ? lottery.store.storeName : lottery.product.productName}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-mono uppercase truncate">
                            {lottery.product.tcgCategory?.name}{lottery.set?.setName ? ` • ${lottery.set.setName}` : ""}
                        </p>
                    </div>
                    <div className={`pt-3 space-y-2 border-t text-[10px] ${isBonbon ? "border-rose-500/20" : "border-brand-border"}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 font-bold uppercase flex items-center gap-1.5"><Store className="w-3 h-3" />Store</span>
                            <span className="font-black text-white truncate ml-2 max-w-[55%] text-right">{lottery.store.storeName}</span>
                        </div>
                        {lottery.applicationEnd && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-bold uppercase flex items-center gap-1.5"><Calendar className="w-3 h-3" />Deadline</span>
                                <span className={`font-black ${isEndingSoon ? "text-rose-400 animate-pulse" : "text-white"}`}>{fmt(lottery.applicationEnd)}</span>
                            </div>
                        )}
                        {lottery.resultDate && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-bold uppercase flex items-center gap-1.5"><Bell className="w-3 h-3" />Results</span>
                                <span className="font-black text-gray-400">{fmt(lottery.resultDate)}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className={`mt-4 pt-3 border-t border-brand-border/20 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest group-hover:gap-3 transition-all ${isBonbon ? "text-rose-400" : "text-brand-accent"}`}>
                    <span>View Details</span><ChevronRight className="w-3.5 h-3.5" />
                </div>
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={e => e.stopPropagation()}
                            className={`relative w-full max-w-lg overflow-hidden shadow-2xl ${isBonbon ? "bg-rose-950/95 border border-rose-500/30 rounded-[2rem]" : "bg-[#0e0e11] border border-brand-border rounded-2xl"}`}
                        >
                            {/* Header */}
                            <div className={`p-6 border-b flex items-start gap-4 ${isBonbon ? "border-rose-500/20 bg-rose-500/5" : "border-brand-border bg-indigo-500/5"}`}>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap"><Badge /></div>
                                    <h2 className={`text-xl font-black uppercase tracking-tight leading-tight ${isBonbon ? "text-rose-100" : "text-white"}`}>
                                        {isSale ? lottery.store.storeName : lottery.product.productName}
                                    </h2>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {lottery.product.tcgCategory?.name}{lottery.set?.setName ? ` • ${lottery.set.setName}` : ""}
                                    </p>
                                </div>
                                <button onClick={() => setOpen(false)} className="shrink-0 mt-0.5 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                            {lottery.imageUrl && (
                                <div className="relative h-44 overflow-hidden">
                                    <img src={lottery.imageUrl} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e11] to-transparent" />
                                </div>
                            )}
                            {/* Detail rows */}
                            <div className="p-6 space-y-2.5 max-h-[45vh] overflow-y-auto custom-scrollbar">
                                {[
                                    { icon: Store,    label: "Store",       value: lottery.store.storeName },
                                    { icon: MapPin,   label: "Region",      value: lottery.store.region },
                                    { icon: Calendar, label: "App Start",   value: fmt(lottery.applicationStart) },
                                    { icon: Calendar, label: "Deadline",    value: fmt(lottery.applicationEnd), urgent: isEndingSoon },
                                    { icon: Bell,     label: "Results",     value: fmt(lottery.resultDate) },
                                    { icon: Calendar, label: "Purchase",    value: lottery.purchaseStart ? `${fmt(lottery.purchaseStart)}${lottery.purchaseEnd ? ` – ${fmt(lottery.purchaseEnd)}` : ""}` : null },
                                    { icon: Activity, label: "Inventory",   value: (isSale || isRestock) ? ((lottery as any).inventoryStatus || "—") : null },
                                ].filter(r => r.value).map(({ icon: Icon, label, value, urgent }) => (
                                    <div key={label} className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-2.5 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-2 text-gray-500 font-bold uppercase tracking-widest shrink-0"><Icon className="w-3.5 h-3.5" />{label}</div>
                                        <span className={`font-black text-right ml-3 ${urgent ? "text-rose-400 animate-pulse" : "text-white"}`}>{value}</span>
                                    </div>
                                ))}
                                {lottery.notes && (
                                    <div className="pt-2 mt-1 border-t border-white/[0.04] space-y-1">
                                        <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Notes</div>
                                        <p className="text-xs text-gray-400 leading-relaxed">{lottery.notes}</p>
                                    </div>
                                )}
                            </div>
                            {/* CTA */}
                            <div className="px-6 pb-6 pt-2">
                                <a href={lottery.sourceUrl} target="_blank" rel="noreferrer"
                                    className={`flex items-center justify-center gap-2 w-full h-12 text-xs font-black uppercase tracking-widest transition-all rounded-xl shadow-xl ${isBonbon ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30" : "bg-brand-accent hover:opacity-90 text-white shadow-brand-accent/20"}`}>
                                    <ExternalLink className="w-4 h-4" />
                                    <span>{isSale || isRestock ? "View Source" : "Apply Now"}</span>
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

