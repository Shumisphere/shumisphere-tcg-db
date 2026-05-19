import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, ExternalLink, Calendar, MapPin, Store as StoreIcon, Package, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, ChevronLeft, LayoutGrid, Database, Layers, Heart, Bell, Store, Activity, Plus, Search, WifiOff, XCircle, Boxes } from "lucide-react";
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

export function LotteryTerminal({ initialTerminal }: { initialTerminal?: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" | "COLLECTIBLES" }) {
    const { config } = useTheme();
    const cacheVersionRef = useRef<number>(0);
    useEffect(() => {
        cacheVersionRef.current = (config.layout as any).cacheVersion || 0;
    }, [config]);

    const [view, setView] = useState<"FEED" | "CATEGORIES" | "LOTTERIES">("FEED");
    const [currentTerminal, setCurrentTerminal] = useState<"BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" | "COLLECTIBLES" | null>(null);
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [selectedSet, setSelectedSet] = useState<any>(null);

    const [lotteries, setLotteries] = useState<Lottery[]>([]);
    const [filter, setFilter] = useState("ALL");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [recentSignals, setRecentSignals] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [selectedModalLottery, setSelectedModalLottery] = useState<Lottery | null>(null);

    // Broadcaster for embedding page size updates to prevent double scrollbars in parent iframes
    useEffect(() => {
        if (typeof window === "undefined") return;
        const sendHeight = () => {
            const height = document.body.scrollHeight || document.documentElement.scrollHeight;
            window.parent.postMessage({ type: "set-iframe-height", height }, "*");
        };
        
        sendHeight();

        const observer = new ResizeObserver(() => {
            sendHeight();
        });
        observer.observe(document.body);

        const timeoutId = setTimeout(sendHeight, 1000);

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [lotteries, view, currentTerminal, selectedCategory, selectedSet, filter, searchQuery]);


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

    // Filter out closed lotteries, and sort active signals by upcoming deadlines (nearest to now first)
    const activeCarouselLotteries = lotteries.filter(l => l.status !== "CLOSED" && l.status !== "Closed");
    const sortedActiveLotteries = [...activeCarouselLotteries].sort((a, b) => {
        const timeA = a.applicationEnd ? new Date(a.applicationEnd).getTime() : Infinity;
        const timeB = b.applicationEnd ? new Date(b.applicationEnd).getTime() : Infinity;
        return timeA - timeB;
    });

    const carouselLotteriesWithImages = sortedActiveLotteries.filter(l => l.imageUrl).slice(0, 5);
    const displayLotteries = carouselLotteriesWithImages.length >= 2 
        ? carouselLotteriesWithImages 
        : sortedActiveLotteries.slice(0, 5);

    useEffect(() => {
        if (view !== "FEED" || currentTerminal !== null || displayLotteries.length <= 1) return;
        const interval = setInterval(() => {
            setCarouselIndex(prev => (prev + 1) % displayLotteries.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [view, currentTerminal, displayLotteries.length]);

    const getCountdownText = (endStr: string | null) => {
        if (!endStr) return "";
        const diff = new Date(endStr).getTime() - Date.now();
        if (diff < 0) return "Closed";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h remaining`;
        return `${hours}h remaining`;
    };


    const selectTerminal = (terminal: "BONBON" | "TCG_LOTTERY" | "TCG_RESTOCK" | "SWITCH2" | "COLLECTIBLES" | "ALL") => {
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
        { id: "TCG_LOTTERY", label: "TCG Lotteries", displayLabel: "TCG LOTTERIES", icon: Database, color: "text-indigo-400", bg: "bg-indigo-400/10" },
        { id: "BONBON", label: "Bonbon Lotteries", displayLabel: "BONBON LOTTERIES", icon: LayoutGrid, color: "text-rose-400", bg: "bg-rose-400/10" },
        { id: "TCG_RESTOCK", label: "TCG Restocks", displayLabel: "TCG RESTOCKS", icon: RefreshCw, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        { id: "SWITCH2", label: "Switch 2 Sale & Lotteries", displayLabel: "SWITCH 2 (SALE & LOTTERIES)", icon: Package, color: "text-amber-400", bg: "bg-amber-400/10" },
        { id: "COLLECTIBLES", label: "Collectible Sale & Lotteries", displayLabel: "COLLECTIBLES (SALE & LOTTERIES)", icon: Boxes, color: "text-purple-400", bg: "bg-purple-400/10" },
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
                        className="space-y-10"
                    >
                        {currentTerminal !== null ? (
                            <div className="space-y-6">
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
                            </div>
                        ) : (
                            // ── REDESIGNED STRUCTURED HOME FEED (Everything view) ──
                            <div className="space-y-10">
                                
                                {/* 1. Premium Featured Carousel */}
                                {displayLotteries.length > 0 && (
                                    <div className="relative min-h-[300px] md:h-80 w-full bg-[#070709] border border-brand-border rounded-2xl overflow-hidden flex flex-col md:flex-row items-stretch shadow-2xl transition-all select-none">
                                        
                                        {/* Radial background glow corresponding to active category */}
                                        <div className={`absolute -inset-10 bg-radial-gradient bg-gradient-to-br ${
                                            displayLotteries[carouselIndex].category === 'BONBON' ? 'from-rose-500/10' :
                                            displayLotteries[carouselIndex].category === 'TCG_RESTOCK' ? 'from-emerald-500/10' :
                                            displayLotteries[carouselIndex].category === 'SWITCH2' ? 'from-amber-500/10' :
                                            displayLotteries[carouselIndex].category === 'COLLECTIBLES' ? 'from-purple-500/10' :
                                            'from-indigo-500/10'
                                        } to-transparent blur-3xl opacity-60 pointer-events-none transition-all duration-500`} />
                                        
                                        {displayLotteries[carouselIndex].imageUrl ? (
                                            <>
                                                {/* Left Side: Information details */}
                                                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between relative z-10">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`px-2.5 py-0.5 rounded bg-black/40 border border-brand-border text-[8px] font-mono font-black uppercase tracking-widest ${
                                                                displayLotteries[carouselIndex].category === 'BONBON' ? 'text-rose-400 border-rose-500/20' :
                                                                displayLotteries[carouselIndex].category === 'TCG_RESTOCK' ? 'text-emerald-400 border-emerald-500/20' :
                                                                displayLotteries[carouselIndex].category === 'SWITCH2' ? 'text-amber-400 border-amber-500/20' :
                                                                displayLotteries[carouselIndex].category === 'COLLECTIBLES' ? 'text-purple-400 border-purple-500/20' :
                                                                'text-indigo-400 border-indigo-500/20'
                                                            }`}>
                                                                {displayLotteries[carouselIndex].category === 'BONBON' ? 'BONBON_FEED' :
                                                                 displayLotteries[carouselIndex].category === 'TCG_RESTOCK' ? 'RESTOCK_INTEL' :
                                                                 displayLotteries[carouselIndex].category === 'SWITCH2' ? 'SWITCH_2_FEEDS' :
                                                                 displayLotteries[carouselIndex].category === 'COLLECTIBLES' ? 'COLLECTIBLES_FEED' :
                                                                 'TCG_LOTTERIES'}
                                                            </span>
                                                            
                                                            {displayLotteries[carouselIndex].applicationEnd && (
                                                                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {getCountdownText(displayLotteries[carouselIndex].applicationEnd)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight text-white line-clamp-2 font-mono leading-none">
                                                                {displayLotteries[carouselIndex].product?.productName || displayLotteries[carouselIndex].store?.storeName}
                                                            </h2>
                                                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                                                {displayLotteries[carouselIndex].product?.franchise || "Featured Drop"} • {displayLotteries[carouselIndex].store?.storeName}
                                                            </p>
                                                        </div>
                                                        
                                                        <p className="text-[10px] text-gray-400 max-w-lg line-clamp-2 leading-relaxed uppercase">
                                                            {displayLotteries[carouselIndex].conditions || displayLotteries[carouselIndex].notes || "Real-time signals detected and committing live. Inspect source to verify entries and requirements."}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Action deck */}
                                                    <div className="flex items-center justify-between pt-6 md:pt-0 mt-6 md:mt-auto border-t border-[#1a1a1c]/40 md:border-t-0">
                                                        <button 
                                                            onClick={() => setSelectedModalLottery(displayLotteries[carouselIndex])}
                                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center gap-2"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            <span>View Details</span>
                                                        </button>
                                                        
                                                        {/* Navigation Indicators */}
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-1">
                                                                {displayLotteries.map((_, idx) => (
                                                                    <button 
                                                                        key={idx}
                                                                        onClick={() => setCarouselIndex(idx)}
                                                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${carouselIndex === idx ? "bg-indigo-500 w-4" : "bg-gray-800"}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => setCarouselIndex(prev => (prev - 1 + displayLotteries.length) % displayLotteries.length)}
                                                                    className="p-1.5 bg-[#1a1a1c] border border-brand-border rounded-lg text-gray-500 hover:text-white transition-all"
                                                                >
                                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setCarouselIndex(prev => (prev + 1) % displayLotteries.length)}
                                                                    className="p-1.5 bg-[#1a1a1c] border border-brand-border rounded-lg text-gray-500 hover:text-white transition-all"
                                                                >
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Right Side: Masked image wrapper */}
                                                <div className="w-full md:w-1/2 h-44 md:h-auto relative shrink-0 overflow-hidden bg-[#0a0a0c]">
                                                    <img 
                                                        src={displayLotteries[carouselIndex].imageUrl!} 
                                                        alt="" 
                                                        className="w-full h-full object-cover transition-transform duration-[4000ms] scale-105 hover:scale-100"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-transparent to-transparent md:bg-gradient-to-r md:from-[#070709] md:via-[#070709]/40 md:to-transparent" />
                                                    
                                                    <span className="absolute top-4 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/[0.05] text-white text-[8px] font-black uppercase tracking-widest rounded font-mono">
                                                        Featured_Signal
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            /* Unified Centered Layout when there is no image */
                                            <div className="w-full p-6 md:p-10 flex flex-col justify-between items-center text-center relative z-10">
                                                <div className="space-y-4 flex flex-col items-center w-full">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <span className={`px-2.5 py-0.5 rounded bg-black/40 border border-brand-border text-[8px] font-mono font-black uppercase tracking-widest ${
                                                            displayLotteries[carouselIndex].category === 'BONBON' ? 'text-rose-400 border-rose-500/20' :
                                                            displayLotteries[carouselIndex].category === 'TCG_RESTOCK' ? 'text-emerald-400 border-emerald-500/20' :
                                                            displayLotteries[carouselIndex].category === 'SWITCH2' ? 'text-amber-400 border-amber-500/20' :
                                                            displayLotteries[carouselIndex].category === 'COLLECTIBLES' ? 'text-purple-400 border-purple-500/20' :
                                                            'text-indigo-400 border-indigo-500/20'
                                                        }`}>
                                                            {displayLotteries[carouselIndex].category === 'BONBON' ? 'BONBON_FEED' :
                                                             displayLotteries[carouselIndex].category === 'TCG_RESTOCK' ? 'RESTOCK_INTEL' :
                                                             displayLotteries[carouselIndex].category === 'SWITCH2' ? 'SWITCH_2_FEEDS' :
                                                             displayLotteries[carouselIndex].category === 'COLLECTIBLES' ? 'COLLECTIBLES_FEED' :
                                                             'TCG_LOTTERIES'}
                                                        </span>
                                                        
                                                        {displayLotteries[carouselIndex].applicationEnd && (
                                                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {getCountdownText(displayLotteries[carouselIndex].applicationEnd)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-2 max-w-2xl">
                                                        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white line-clamp-2 font-mono leading-none">
                                                            {displayLotteries[carouselIndex].product?.productName || displayLotteries[carouselIndex].store?.storeName}
                                                        </h2>
                                                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                                            {displayLotteries[carouselIndex].product?.franchise || "Featured Drop"} • {displayLotteries[carouselIndex].store?.storeName}
                                                        </p>
                                                    </div>
                                                    
                                                    <p className="text-[10px] text-gray-400 max-w-xl line-clamp-2 leading-relaxed uppercase">
                                                        {displayLotteries[carouselIndex].conditions || displayLotteries[carouselIndex].notes || "Real-time signals detected and committing live. Inspect source to verify entries and requirements."}
                                                    </p>
                                                </div>
                                                
                                                {/* Action deck */}
                                                <div className="flex flex-col sm:flex-row items-center justify-between pt-6 mt-6 border-t border-[#1a1a1c]/40 w-full">
                                                    <button 
                                                        onClick={() => setSelectedModalLottery(displayLotteries[carouselIndex])}
                                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center gap-2 mb-4 sm:mb-0"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        <span>View Details</span>
                                                    </button>
                                                    
                                                    {/* Navigation Indicators */}
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1">
                                                            {displayLotteries.map((_, idx) => (
                                                                <button 
                                                                    key={idx}
                                                                    onClick={() => setCarouselIndex(idx)}
                                                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${carouselIndex === idx ? "bg-indigo-500 w-4" : "bg-gray-800"}`}
                                                                />
                                                            ))}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={() => setCarouselIndex(prev => (prev - 1 + displayLotteries.length) % displayLotteries.length)}
                                                                className="p-1.5 bg-[#1a1a1c] border border-brand-border rounded-lg text-gray-500 hover:text-white transition-all"
                                                            >
                                                                <ChevronLeft className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setCarouselIndex(prev => (prev + 1) % displayLotteries.length)}
                                                                className="p-1.5 bg-[#1a1a1c] border border-brand-border rounded-lg text-gray-500 hover:text-white transition-all"
                                                                >
                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* 2. Structured Terminal Hub Cards */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-white">Active Operations Deck</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Select a node to browse raw entry lists and category-specific stats</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                        {terminals.map(term => {
                                            const termEvents = lotteries.filter(l => 
                                                term.id === "TCG_LOTTERY" 
                                                ? (!l.category || l.category === "TCG_LOTTERY") 
                                                : l.category === term.id
                                            );
                                            const activeCount = termEvents.filter(e => e.status !== "CLOSED").length;
                                            
                                            let displayEvents = termEvents;
                                            if (term.id === "TCG_LOTTERY" || term.id === "BONBON") {
                                                // Filter active events with a valid deadline in the future, and sort by deadline ascending (nearest first)
                                                displayEvents = termEvents
                                                    .filter(e => e.status !== "CLOSED" && e.applicationEnd && new Date(e.applicationEnd).getTime() > Date.now())
                                                    .sort((a, b) => new Date(a.applicationEnd!).getTime() - new Date(b.applicationEnd!).getTime());
                                                
                                                // If we have fewer than 3 events, supplement with other active/closed ones to preserve layout structure
                                                if (displayEvents.length < 3) {
                                                    const extra = termEvents.filter(e => !displayEvents.find(d => d.id === e.id));
                                                    displayEvents = [...displayEvents, ...extra];
                                                }
                                            }
                                            const latestEvents = displayEvents.slice(0, 3);
                                            
                                            return (
                                                <button
                                                    key={term.id}
                                                    onClick={() => selectTerminal(term.id as any)}
                                                    className="group text-left bg-[#0e0e11] border border-brand-border rounded-2xl p-5 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/5 flex flex-col justify-between h-80 relative overflow-hidden shrink-0"
                                                >
                                                    {/* Background hover accent */}
                                                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${
                                                        term.id === 'BONBON' ? 'from-rose-500/10' :
                                                        term.id === 'TCG_RESTOCK' ? 'from-emerald-500/10' :
                                                        term.id === 'SWITCH2' ? 'from-amber-500/10' :
                                                        term.id === 'COLLECTIBLES' ? 'from-purple-500/10' :
                                                        'from-indigo-500/10'
                                                    } to-transparent blur-2xl group-hover:opacity-100 opacity-0 transition-all duration-500`} />
                                                    
                                                    <div className="space-y-4 w-full">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl ${term.bg} flex items-center justify-center border border-[#1a1a1c] group-hover:scale-110 transition-all duration-300`}>
                                                                    <term.icon className={`w-5 h-5 ${term.color}`} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-white line-clamp-1">{term.displayLabel}</h4>
                                                                    <p className="text-[8px] text-gray-600 uppercase tracking-widest font-mono">Terminal_Node</p>
                                                                </div>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black font-mono border whitespace-nowrap ${
                                                                activeCount > 0 
                                                                ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" 
                                                                : "bg-[#1a1a1c] text-gray-600 border-brand-border"
                                                            }`}>
                                                                {activeCount} ACTIVE
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Preview List of 3 Latest Events */}
                                                        <div className="space-y-2.5 pt-4 border-t border-[#1a1a1c] w-full">
                                                            {latestEvents.map(ev => {
                                                                const evEnding = ev.applicationEnd && new Date(ev.applicationEnd).getTime() - Date.now() < 86400000;
                                                                return (
                                                                    <div key={ev.id} className="flex items-center justify-between gap-3 text-[9px] py-0.5 border-b border-[#1a1a1c]/30 last:border-b-0">
                                                                        <span className="text-gray-400 font-bold uppercase truncate max-w-[65%] line-clamp-1">{ev.product?.productName || ev.store?.storeName}</span>
                                                                        <span className={`font-mono font-bold shrink-0 ${evEnding ? "text-rose-400 animate-pulse" : "text-gray-600"}`}>
                                                                            {ev.applicationEnd ? new Date(ev.applicationEnd).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "no date"}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {latestEvents.length === 0 && (
                                                                <div className="py-8 text-center text-gray-700 text-[9px] uppercase font-bold tracking-widest italic">
                                                                    No active signals
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Access Action */}
                                                    <div className="pt-4 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-400 group-hover:text-indigo-300 group-hover:gap-2 transition-all mt-auto border-t border-[#1a1a1c]/20 w-full">
                                                        <span>Access Node Feed</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* 3. Real-Time Operations Log / Live Global Feed */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-white">Live Global Operations Stream</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Consolidated live transmission logs of all active signals across the network</p>
                                    </div>
                                    
                                    <div className="bg-[#0e0e11] border border-brand-border rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="px-5 py-3 border-b border-brand-border bg-[#111114] flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Ingested_Signal</span>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Target_Node</span>
                                        </div>
                                        <div className="divide-y divide-[#1a1a1c] max-h-96 overflow-y-auto custom-scrollbar font-mono text-[10px]">
                                            {filtered.slice(0, 15).map((lottery) => {
                                                const isEvEnding = lottery.applicationEnd && new Date(lottery.applicationEnd).getTime() - Date.now() < 86400000;
                                                return (
                                                    <div 
                                                        key={lottery.id} 
                                                        onClick={() => setSelectedModalLottery(lottery)}
                                                        className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors cursor-pointer group"
                                                    >
                                                        <div className="min-w-0 flex items-center gap-3">
                                                            {/* Status dot reflecting type */}
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                lottery.category === 'BONBON' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' :
                                                                lottery.category === 'TCG_RESTOCK' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                                                                lottery.category === 'SWITCH2' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' :
                                                                lottery.category === 'COLLECTIBLES' ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' :
                                                                'bg-indigo-500 shadow-[0_0_8px_#6366f1]'
                                                            }`} />
                                                            <div>
                                                                <div className="font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                                                                    {lottery.product?.productName || lottery.store?.storeName}
                                                                </div>
                                                                <div className="text-[9px] text-gray-600 uppercase font-bold tracking-wider mt-0.5">
                                                                    {lottery.store?.storeName} • {lottery.store?.region}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-6 shrink-0">
                                                            <div className="text-right hidden sm:block">
                                                                <div className={`font-bold ${isEvEnding ? "text-rose-400 animate-pulse" : "text-gray-400"}`}>
                                                                    {lottery.applicationEnd ? new Date(lottery.applicationEnd).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : "no deadline"}
                                                                </div>
                                                                <div className="text-[8px] text-gray-600 uppercase tracking-widest mt-0.5">Deadline</div>
                                                            </div>
                                                            
                                                            <span className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase ${
                                                                lottery.category === 'BONBON' ? 'bg-rose-950/40 border-rose-500/20 text-rose-400' :
                                                                lottery.category === 'TCG_RESTOCK' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
                                                                lottery.category === 'SWITCH2' ? 'bg-amber-950/40 border-amber-500/20 text-amber-400' :
                                                                lottery.category === 'COLLECTIBLES' ? 'bg-purple-950/40 border-purple-500/20 text-purple-400' :
                                                                'bg-indigo-950/40 border-indigo-500/20 text-indigo-400'
                                                            }`}>
                                                                {lottery.category || 'TCG_LOTTERY'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {filtered.length === 0 && (
                                                <div className="py-20 text-center text-gray-500 italic uppercase font-bold tracking-widest">
                                                    No active signals in stream
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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

            <AnimatePresence>
                {selectedModalLottery && (
                    <LotteryDetailModal 
                        lottery={selectedModalLottery} 
                        onClose={() => setSelectedModalLottery(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function LotteryDetailModal({ lottery, onClose }: { lottery: any; onClose: () => void }) {
    const { config } = useTheme();
    const isEndingSoon = lottery.applicationEnd && new Date(lottery.applicationEnd).getTime() - Date.now() < 86400000;
    const isBonbon = lottery.category === "BONBON";
    const isRestock = lottery.category === "TCG_RESTOCK";
    const isSale = lottery.category === "SWITCH2";
    const isCollectibles = lottery.category === "COLLECTIBLES";
    const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : null;

    const Badge = () => {
        const s = lottery.status;
        if (s === "APPLICATION_OPEN" || s === "Accepting Applications") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : isCollectibles ? "bg-purple-950/40 text-purple-300 border-purple-500/30" : "bg-[#1e2a1e] text-[#00ff9d] border-[#2d4d2d]"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-rose-400" : isCollectibles ? "bg-purple-400" : "bg-[#00ff9d]"}`} />
                    ACCEPTING APPLICATIONS
                </span>
            );
        }
        if (s === "WINNER_ANNOUNCEMENT" || s === "Winner Announcement") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : isCollectibles ? "bg-purple-950/40 text-purple-300 border-purple-500/30" : "bg-indigo-950/40 text-indigo-300 border-indigo-500/30"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-pink-400" : isCollectibles ? "bg-purple-400" : "bg-[#6366f1]"}`} />
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
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className={`relative w-full max-w-lg overflow-hidden shadow-2xl ${isBonbon ? "bg-rose-950/95 border border-rose-500/30 rounded-[2rem]" : isCollectibles ? "bg-purple-950/95 border border-purple-500/30 rounded-2xl" : "bg-[#0e0e11] border border-brand-border rounded-2xl"}`}
            >
                {/* Header */}
                <div className={`p-6 border-b flex items-start gap-4 ${isBonbon ? "border-rose-500/20 bg-rose-500/5" : isCollectibles ? "border-purple-500/20 bg-purple-500/5" : "border-brand-border bg-indigo-500/5"}`}>
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap"><Badge /></div>
                        <h2 className={`text-xl font-black uppercase tracking-tight leading-tight ${isBonbon ? "text-rose-100" : isCollectibles ? "text-purple-100" : "text-white"}`}>
                            {isSale ? lottery.store.storeName : lottery.product.productName}
                        </h2>
                        <p className="text-xs text-gray-500 font-mono">
                            {lottery.product.tcgCategory?.name}{lottery.set?.setName ? ` • ${lottery.set.setName}` : ""}
                        </p>
                    </div>
                    <button onClick={onClose} className="shrink-0 mt-0.5 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
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
                <div className="p-6 space-y-2.5 max-h-[45vh] overflow-y-auto custom-scrollbar text-[11px] font-mono">
                    {[
                        { icon: Store,    label: "Store",       value: lottery.store.storeName },
                        { icon: MapPin,   label: "Region",      value: lottery.store.region },
                        { icon: Calendar, label: "App Start",   value: fmt(lottery.applicationStart) },
                        { icon: Calendar, label: "Deadline",    value: fmt(lottery.applicationEnd), urgent: isEndingSoon },
                        { icon: Bell,     label: "Results",     value: fmt(lottery.resultDate) },
                        { icon: Calendar, label: "Purchase",    value: lottery.purchaseStart ? `${fmt(lottery.purchaseStart)}${lottery.purchaseEnd ? ` – ${fmt(lottery.purchaseEnd)}` : ""}` : null },
                        { icon: Activity, label: "Inventory",   value: (isSale || isRestock) ? ((lottery as any).inventoryStatus || "—") : null },
                    ].filter(row => row.value).map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2.5 border-b border-white/[0.02] last:border-0">
                            <span className="text-gray-500 font-bold uppercase flex items-center gap-2"><row.icon className="w-3.5 h-3.5" />{row.label}</span>
                            <span className={`font-black text-right truncate max-w-[65%] ${row.urgent ? "text-rose-400 animate-pulse" : "text-white"}`}>{row.value}</span>
                        </div>
                    ))}
                    {lottery.conditions && (
                        <div className="pt-4 border-t border-white/[0.04]">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Entry Conditions</div>
                            <p className="text-[10px] text-indigo-200 bg-indigo-500/[0.03] border border-indigo-500/10 p-3 rounded-lg leading-relaxed uppercase">{lottery.conditions}</p>
                        </div>
                    )}
                    {lottery.notes && (
                        <div className="pt-4 border-t border-white/[0.04]">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Intelligence Notes</div>
                            <p className="text-[10px] text-gray-400 bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg leading-relaxed uppercase">{lottery.notes}</p>
                        </div>
                    )}
                    {lottery.sourceUrl && (
                        <div className="pt-4">
                            <a 
                                href={lottery.sourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`w-full py-3 ${isBonbon ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" : isCollectibles ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"} text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2`}
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Inspect Source Page</span>
                            </a>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function LotteryCard({ lottery }: { lottery: Lottery; key?: string }) {
    const { config } = useTheme();
    const [open, setOpen] = useState(false);
    const isEndingSoon = lottery.applicationEnd && new Date(lottery.applicationEnd).getTime() - Date.now() < 86400000;
    const isBonbon = (lottery as any).category === "BONBON";
    const isRestock = (lottery as any).category === "TCG_RESTOCK";
    const isSale = (lottery as any).category === "SWITCH2";
    const isCollectibles = (lottery as any).category === "COLLECTIBLES";
    const cardStyles = isBonbon ? { borderRadius: "2rem" } : { borderRadius: config.theme.cardRadius };
    const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : null;

    const Badge = () => {
        const s = lottery.status;
        if (s === "APPLICATION_OPEN" || s === "Accepting Applications") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : isCollectibles ? "bg-purple-950/40 text-purple-300 border-purple-500/30" : "bg-[#1e2a1e] text-[#00ff9d] border-[#2d4d2d]"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-rose-400" : isCollectibles ? "bg-purple-400" : "bg-[#00ff9d]"}`} />
                    ACCEPTING APPLICATIONS
                </span>
            );
        }
        if (s === "WINNER_ANNOUNCEMENT" || s === "Winner Announcement") {
            return (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${isBonbon ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : isCollectibles ? "bg-purple-950/40 text-purple-300 border-purple-500/30" : "bg-indigo-950/40 text-indigo-300 border-indigo-500/30"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBonbon ? "bg-pink-400" : isCollectibles ? "bg-purple-400" : "bg-[#6366f1]"}`} />
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
                        <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isBonbon ? "text-rose-400/60" : isSale ? "text-emerald-400/60" : isCollectibles ? "text-purple-400/60" : "text-indigo-400/60"}`}>
                            {isSale ? "DEALER CENTER" : lottery.product.franchise || (isBonbon ? "BONBON" : isCollectibles ? "COLLECTIBLES" : "TCG")}
                        </div>
                        <h3 className={`font-black tracking-tight line-clamp-2 leading-tight uppercase font-mono ${isBonbon ? "text-lg text-rose-100" : isSale ? "text-lg text-emerald-100" : isCollectibles ? "text-sm text-purple-100 group-hover:text-purple-400 transition-colors" : "text-sm text-white group-hover:text-indigo-400 transition-colors"}`}>
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
                <div className={`mt-4 pt-3 border-t border-brand-border/20 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest group-hover:gap-3 transition-all ${isBonbon ? "text-rose-400" : isCollectibles ? "text-purple-400" : "text-brand-accent"}`}>
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
                            className={`relative w-full max-w-lg overflow-hidden shadow-2xl ${isBonbon ? "bg-rose-950/95 border border-rose-500/30 rounded-[2rem]" : isCollectibles ? "bg-purple-950/95 border border-purple-500/30 rounded-2xl" : "bg-[#0e0e11] border border-brand-border rounded-2xl"}`}
                        >
                            {/* Header */}
                            <div className={`p-6 border-b flex items-start gap-4 ${isBonbon ? "border-rose-500/20 bg-rose-500/5" : isCollectibles ? "border-purple-500/20 bg-purple-500/5" : "border-brand-border bg-indigo-500/5"}`}>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap"><Badge /></div>
                                    <h2 className={`text-xl font-black uppercase tracking-tight leading-tight ${isBonbon ? "text-rose-100" : isCollectibles ? "text-purple-100" : "text-white"}`}>
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

