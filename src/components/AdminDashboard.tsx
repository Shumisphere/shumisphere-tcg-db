import React, { useState, useEffect, Component } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
    Cpu, 
    Database, 
    CheckCircle, 
    ShieldCheck, 
    Plus, 
    RefreshCw, 
    Trash2, 
    Settings, 
    XCircle, 
    Loader2, 
    Search,
    Boxes,
    Eye,
    MessageSquare,
    Zap,
    ExternalLink,
    Globe,
    Activity,
    Layers,
    Package,
    Store,
    Heart
} from "lucide-react";
import { DesignEngine } from "./DesignEngine";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { IntakeTool } from "./IntakeTool";
import { ImageUploadButton } from "./ImageUploadButton";
import { API_BASE_URL } from "../config";

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };
    
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-10">
                    <div className="max-w-md w-full bg-[#0e0e11] border border-rose-500/30 p-8 rounded-2xl text-center space-y-6">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                            <Activity className="w-8 h-8 text-rose-500" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">System Critical Error</h2>
                        <p className="text-xs text-gray-500 leading-relaxed font-mono">The intelligence dashboard encountered an unhandled exception. UI state has been safely isolated to prevent data corruption.</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                        >
                            Reboot Dashboard
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState({ totalEvents: 0, activeEvents: 0, totalSources: 3 });
    const [isScraping, setIsScraping] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [logs, setLogs] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("admin_logs");
            return saved ? JSON.parse(saved) : ["[SYSTEM] Terminal initialized.", "[SYSTEM] Awaiting intelligence streams..."];
        } catch (e) {
            return ["[SYSTEM] Terminal initialized.", "[SYSTEM] Awaiting intelligence streams..."];
        }
    });
    
    useEffect(() => {
        localStorage.setItem("admin_logs", JSON.stringify(logs.slice(-100)));
    }, [logs]);
    
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'pipeline' | 'intake' | 'design' | 'sources' | 'database'>(() => {
        try {
            return (localStorage.getItem("admin_active_tab") as any) || 'pipeline';
        } catch (e) {
            return 'pipeline';
        }
    });
    
    useEffect(() => {
        localStorage.setItem("admin_active_tab", activeTab);
    }, [activeTab]);
    const [sources, setSources] = useState<any[]>([]);
    const [rawDocuments, setRawDocuments] = useState<any[]>([]);
    const [showSourceForm, setShowSourceForm] = useState(false);
    const [selectedRawDoc, setSelectedRawDoc] = useState<any>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [editingSource, setEditingSource] = useState<any>(null);

    
    // States for various forms
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [selectedSetId, setSelectedSetId] = useState("");
    const [newCatName, setNewCatName] = useState("");
    const [newCatPlayerId, setNewCatPlayerId] = useState("");
    const [newSetName, setNewSetName] = useState("");
    
    const [newSource, setNewSource] = useState({
        sourceName: "",
        sourceType: "SCRAPE",
        domain: "",
        rssUrl: "",
        sitemapUrl: "",
        crawlFrequency: "3600",
        active: true
    });

    const [sourceError, setSourceError] = useState<string | null>(null);
    const [pendingDeleteSourceId, setPendingDeleteSourceId] = useState<string | null>(null);
    const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualEvent, setManualEvent] = useState(() => {
        try {
            const saved = localStorage.getItem("admin_manual_event");
            return saved ? JSON.parse(saved) : {
                productName: "",
                storeName: "",
                applicationStart: "",
                applicationEnd: "",
                resultDate: "",
                purchaseStart: "",
                purchaseEnd: "",
                sourceUrl: "",
                status: "ACTIVE",
                notes: "",
                tcgCategoryId: "",
                setId: "",
                inventoryStatus: "NO_INFO",
                category: "TCG_LOTTERY",
                imageUrl: ""
            };
        } catch (e) {
            return {
                productName: "",
                storeName: "",
                applicationStart: "",
                applicationEnd: "",
                resultDate: "",
                purchaseStart: "",
                purchaseEnd: "",
                sourceUrl: "",
                status: "ACTIVE",
                notes: "",
                tcgCategoryId: "",
                setId: "",
                inventoryStatus: "NO_INFO",
                category: "TCG_LOTTERY",
                imageUrl: ""
            };
        }
    });
    
    const [manualText, setManualText] = useState(() => localStorage.getItem("admin_manual_text") || "");
    const [selectedIngestTerminal, setSelectedIngestTerminal] = useState<string>("TCG_LOTTERY");
    
    useEffect(() => {
        localStorage.setItem("admin_manual_event", JSON.stringify(manualEvent));
    }, [manualEvent]);

    useEffect(() => {
        localStorage.setItem("admin_manual_text", manualText);
    }, [manualText]);



    useEffect(() => {
        fetchStats();
        fetchTcgCategories();
        fetchSources();
        fetchRawDocuments();
    }, []);



    const fetchRawDocuments = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/raw-documents`);
            const data = await res.json();
            setRawDocuments(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/stats`);
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchTcgCategories = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/tcg-categories`);
            const data = await res.json();
            setTcgCategories(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSources = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/sources`);
            const data = await res.json();
            setSources(data);
        } catch (e) {
            console.error(e);
        }
    };

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const syncToFrontend = async () => {
        setIsSyncing(true);
        addLog("[SYSTEM] Triggering frontend sync...");
        try {
            const res = await fetch(`${API_BASE_URL}/api/sync-frontend`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            addLog(`[SYSTEM] Sync complete: ${data.message}`);
        } catch (e: any) {
            addLog(`[ERROR] Sync failed: ${e.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const triggerScrape = async () => {
        setIsScraping(true);
        addLog("[SYSTEM] Initiating global source intelligence crawl...");
        try {
            const res = await fetch(`${API_BASE_URL}/api/scrape`, { method: "POST" });
            const data = await res.json();
            
            const successCount = data.results.filter((r: any) => r.status === "SUCCESS").length;
            const failedCount = data.results.filter((r: any) => r.status === "FAILED").length;
            
            addLog(`[SYSTEM] Scrape finished. Success: ${successCount}, Failed: ${failedCount}.`);
            
            data.results.forEach((r: any) => {
                if (r.status === "FAILED") {
                    addLog(`[ERROR] ${r.source}: ${r.error}`);
                }
            });

            fetchStats();
            fetchRawDocuments();
        } catch (e) {
            addLog("[ERROR] Scrape engine failure.");
        } finally {
            setIsScraping(false);
        }
    };

    const createSource = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/sources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSource)
            });
            if (res.ok) {
                fetchSources();
                setShowSourceForm(false);
                setNewSource({ sourceName: "", sourceType: "SCRAPE", domain: "", rssUrl: "", sitemapUrl: "", crawlFrequency: "3600", active: true });
                addLog(`[SYSTEM] New source ${newSource.sourceName} added.`);
            }
        } catch (e) {
            addLog("[ERROR] Failed to create source.");
        }
    };

    const updateSource = async (id: string, data: any) => {
        try {
            await fetch(`${API_BASE_URL}/api/sources/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            fetchSources();
            setEditingSource(null);
            addLog("[SYSTEM] Source updated.");
        } catch (e) {
            addLog("[ERROR] Failed to update source.");
        }
    };

    const deleteRawDocument = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/raw-documents/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || `HTTP ${res.status}`);
            }
            fetchRawDocuments();
            addLog("[SYSTEM] Raw document purged.");
        } catch (e: any) {
            addLog(`[ERROR] Purge failed: ${e.message}`);
        }
    };
    const deleteSource = async (id: string) => {
        setSourceError(null);
        setPendingDeleteSourceId(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/sources/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || `HTTP ${res.status}`);
            }
            fetchSources();
            addLog("[SYSTEM] Source monitor removed.");
        } catch (e: any) {
            setSourceError(`Delete failed: ${e.message}`);
            addLog(`[ERROR] Failed to delete source: ${e.message}`);
        }
    };

    const createCategory = async () => {
        if (!newCatName) return;
        try {
            await fetch(`${API_BASE_URL}/api/tcg-categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCatName })
            });
            setNewCatName("");
            fetchTcgCategories();
            addLog(`[SYSTEM] Category created: ${newCatName}`);
        } catch (e) {
            addLog("[ERROR] Category creation failed.");
        }
    };

    const createSet = async () => {
        if (!newSetName || !selectedCategoryId) return;
        try {
            await fetch(`${API_BASE_URL}/api/tcg-categories/${selectedCategoryId}/sets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ setName: newSetName })
            });
            setNewSetName("");
            fetchTcgCategories();
            addLog(`[SYSTEM] Set created: ${newSetName}`);
        } catch (e) {
            addLog("[ERROR] Set creation failed.");
        }
    };


    const handleManualIngest = async () => {
        if (!manualText.trim()) return;
        setIsExtracting(true);
        addLog("[SYSTEM] Initiating manual text ingestion...");
        try {
            const res = await fetch(`${API_BASE_URL}/api/raw-documents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: manualText, sourceId: "manual" })
            });
            const data = await res.json();
            addLog(`[SYSTEM] Extraction successful: ${data.events?.length || 0} events identified.`);
            fetchLotteries();
            fetchStats();
            fetchRawDocuments();
        } catch (e) {
            addLog("[ERROR] Manual ingest failed.");
        } finally {
            setIsExtracting(false);
        }
    };


    const handleCreateManualEvent = async () => {
        try {
            setIsExtracting(true);
            const res = await fetch(`${API_BASE_URL}/api/lotteries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    info: {
                        productName: manualEvent.productName,
                        storeName: manualEvent.storeName,
                        status: manualEvent.status,
                        notes: manualEvent.notes,
                        applicationStart: manualEvent.applicationStart ? new Date(manualEvent.applicationStart).toISOString() : null,
                        applicationEnd: manualEvent.applicationEnd ? new Date(manualEvent.applicationEnd).toISOString() : null,
                        resultDate: manualEvent.resultDate ? new Date(manualEvent.resultDate).toISOString() : null,
                        purchaseStart: manualEvent.purchaseStart ? new Date(manualEvent.purchaseStart).toISOString() : null,
                        purchaseEnd: manualEvent.purchaseEnd ? new Date(manualEvent.purchaseEnd).toISOString() : null,
                        imageUrl: manualEvent.imageUrl,
                    }, 
                    sourceId: null, 
                    url: manualEvent.sourceUrl || "(MANUAL)",
                    tcgCategoryId: manualEvent.tcgCategoryId || selectedCategoryId,
                    setId: manualEvent.setId || selectedSetId,
                    category: manualEvent.category || selectedIngestTerminal,
                    inventoryStatus: manualEvent.inventoryStatus
                })
            });
            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
            }
            addLog(`[SYSTEM] Manual event created: ${manualEvent.productName} at ${manualEvent.storeName}.`);
            setShowManualForm(false);
            fetchStats();
            setManualEvent({ 
                productName: "", 
                storeName: "", 
                applicationStart: "",
                applicationEnd: "", 
                resultDate: "",
                purchaseStart: "",
                purchaseEnd: "",
                sourceUrl: "", 
                status: "ACTIVE", 
                notes: "",
                tcgCategoryId: "",
                setId: "",
                inventoryStatus: "NO_INFO",
                category: "TCG_LOTTERY",
                imageUrl: ""
            });
            fetchLotteries();
            fetchStats();
        } catch (e) {
            addLog(`[ERROR] Manual creation failed: ${String(e)}`);
        } finally {
            setIsExtracting(false);
        }
    };

    const fetchLotteries = async () => {
        fetchStats();
        fetchRawDocuments();
    };

    const deleteCategory = async (id: string) => {
        setPendingDeleteCategoryId(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/tcg-categories/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || `HTTP ${res.status}`);
            }
            fetchTcgCategories();
            addLog("[SYSTEM] Category removed.");
        } catch (e: any) {
            addLog(`[ERROR] Failed to delete category: ${e.message}`);
        }
    };

    const deleteSet = async (categoryId: string, setId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/tcg-categories/${categoryId}/sets/${setId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || `HTTP ${res.status}`);
            }
            fetchTcgCategories();
            addLog("[SYSTEM] Set expansion removed.");
            if (selectedSetId === setId) setSelectedSetId("");
        } catch (e: any) {
            addLog(`[ERROR] Failed to delete set: ${e.message}`);
        }
    };

    return (
        <ErrorBoundary>
            <div className="flex flex-col md:flex-row min-h-screen bg-brand-bg">
                {/* Sidebar */}
                <aside className="w-full md:w-64 border-r border-brand-border bg-[#0e0e11] p-4 md:p-6 shrink-0">
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Navigation</h2>
                            <div className="flex flex-col gap-1">
                                <button 
                                    onClick={() => setActiveTab('pipeline')}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'pipeline' ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'}`}
                                >
                                    <Cpu className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">Dashboard</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('intake')}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'intake' ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'}`}
                                >
                                    <Zap className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">Add Entry</span>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('database')}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'database' ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'}`}
                                >
                                    <Database className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">Database</span>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('sources')}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'sources' ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'}`}
                                >
                                    <Globe className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">Sources</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('design')}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'design' ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'}`}
                                >
                                    <Boxes className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-bold">Design</span>
                                </button>
                            </div>
                        </div>

                        {activeTab === 'pipeline' && (
                            <div>
                                <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Quick Actions</h2>
                                <div className="space-y-2">
                                    <button
                                        onClick={triggerScrape}
                                        disabled={isScraping}
                                        className="w-full flex items-center gap-2 px-4 py-2 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-all text-xs font-bold"
                                    >
                                        {isScraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Cpu className="w-3.5 h-3.5 shrink-0" />}
                                        <span>Run Discovery</span>
                                    </button>
                                    <button
                                        onClick={syncToFrontend}
                                        disabled={isSyncing}
                                        className="w-full flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-all text-xs font-bold"
                                    >
                                        {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Globe className="w-3.5 h-3.5 shrink-0" />}
                                        <span>Sync to Frontend</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">

            <div className="mt-6">
                {activeTab === 'sources' && (
                    <div
                        key="sources"
                        className="space-y-6"
                    >
                        <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-brand-border bg-[#111114] flex justify-between items-center">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-brand-accent" />
                                    <span>Intelligence Source Monitors</span>
                                </h3>
                                <button 
                                    onClick={() => {
                                        setEditingSource(null);
                                        setNewSource({ sourceName: "", sourceType: "SCRAPE", domain: "", rssUrl: "", sitemapUrl: "", crawlFrequency: "3600", active: true });
                                        setShowSourceForm(true);
                                    }}
                                    className="px-3 py-1 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Deploy Node</span>
                                </button>
                            </div>
                            {sourceError && (
                            <div className="mx-4 mt-4 px-4 py-2 bg-rose-900/20 border border-rose-500/30 rounded text-[10px] font-mono text-rose-400 flex items-center justify-between">
                                <span>{sourceError}</span>
                                <button onClick={() => setSourceError(null)} className="ml-4 text-rose-600 hover:text-rose-400">✕</button>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] font-mono whitespace-nowrap md:whitespace-normal">
                                    <thead className="bg-black text-[9px] text-gray-500 uppercase tracking-widest border-b border-brand-border font-bold">
                                        <tr>
                                            <th className="px-6 py-4">Source & Domain</th>
                                            <th className="px-6 py-4">Protocol</th>
                                            <th className="px-6 py-4 hidden md:table-cell">Frequency</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Control</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1a1a1c]">
                                        {sources.map(s => (
                                            <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white uppercase">{s.sourceName}</div>
                                                    <div className="text-[10px] text-gray-600 truncate max-w-[200px] md:max-w-xs lowercase italic font-sans">{s.domain}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 rounded bg-[#1a1a1c] border border-brand-border text-gray-400 font-bold uppercase text-[9px]">
                                                        {s.sourceType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                                                    {s.crawlFrequency}S
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => updateSource(s.id, { active: !s.active })}
                                                        className={`flex items-center gap-1.5 font-bold text-[9px] uppercase transition-colors ${s.active ? "text-brand-success" : "text-rose-500"}`}
                                                    >
                                                        <ShieldCheck className={`w-3.5 h-3.5 ${s.active ? "opacity-100" : "opacity-30"}`} />
                                                        <span>{s.active ? "ACTIVE" : "DISABLED"}</span>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {pendingDeleteSourceId === s.id ? (
                                                            <>
                                                                <button
                                                                    onClick={() => deleteSource(s.id)}
                                                                    className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded hover:bg-rose-500/30 transition-all"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    onClick={() => setPendingDeleteSourceId(null)}
                                                                    className="px-2 py-1 text-[9px] font-black uppercase text-gray-500 hover:text-gray-300 transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingSource(s);
                                                                        setNewSource({
                                                                            sourceName: s.sourceName,
                                                                            sourceType: s.sourceType,
                                                                            domain: s.domain,
                                                                            rssUrl: s.rssUrl || "",
                                                                            sitemapUrl: s.sitemapUrl || "",
                                                                            crawlFrequency: s.crawlFrequency.toString(),
                                                                            active: s.active
                                                                        });
                                                                        setShowSourceForm(true);
                                                                    }}
                                                                    className="p-1 hover:text-brand-accent transition-colors"
                                                                >
                                                                    <Settings className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setPendingDeleteSourceId(s.id)}
                                                                    className="p-1 hover:text-rose-500 transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'intake' && (
                    <div key="intake">
                        <IntakeTool />
                    </div>
                )}
                {activeTab === 'design' && (
                    <div
                        key="design"
                    >
                        <DesignEngine />
                    </div>
                )}
                {activeTab === 'database' && (
                    <DatabaseExplorer />
                )}
                {activeTab === 'pipeline' && (
                    <div
                        key="pipeline"
                        className="space-y-6 animate-in fade-in duration-500"
                    >
                        {/* High-Level Pulse Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#0e0e11] border border-brand-border rounded-xl p-4 flex items-center justify-between group hover:border-indigo-500/50 transition-all">
                                <div>
                                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Total_Intelligence_Nodes</div>
                                    <div className="text-xl font-bold text-white font-mono">{stats.totalEvents}</div>
                                </div>
                                <Database className="w-8 h-8 text-indigo-500/10 group-hover:text-indigo-500/20 transition-colors" />
                            </div>
                            <div className="bg-[#0e0e11] border border-brand-border rounded-xl p-4 flex items-center justify-between group hover:border-brand-success/50 transition-all">
                                <div>
                                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Active_Signals</div>
                                    <div className="text-xl font-bold text-brand-success font-mono">{stats.activeEvents}</div>
                                </div>
                                <CheckCircle className="w-8 h-8 text-brand-success/10 group-hover:text-brand-success/20 transition-colors" />
                            </div>
                            <div className="bg-[#0e0e11] border border-brand-border rounded-xl p-4 flex items-center justify-between group hover:border-gray-600 transition-all">
                                <div>
                                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Monitored_Sources</div>
                                    <div className="text-xl font-bold text-white font-mono">{stats.totalSources}</div>
                                </div>
                                <ShieldCheck className="w-8 h-8 text-gray-500/10 group-hover:text-gray-500/20 transition-colors" />
                            </div>
                        </div>

                        {/* Routing Protocol Selector */}
                        <div className="bg-[#0e0e11] border border-brand-border rounded-2xl p-6 space-y-8 shadow-2xl">
                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
                                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-indigo-400" />
                                    <span>Active Routing Nodes</span>
                                </h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={triggerScrape}
                                        className="px-4 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-[9px] font-black rounded-lg uppercase hover:bg-indigo-600/30 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? "animate-spin" : ""}`} />
                                        <span>Force_Sync</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { id: "TCG_LOTTERY", label: "TCG_LOTTERIES", desc: "Standard lottery data", icon: Database, color: "text-indigo-400" },
                                    { id: "BONBON", label: "BONBON_FEED", desc: "Bonbon sticker stream", icon: Heart, color: "text-rose-400" },
                                    { id: "TCG_RESTOCK", label: "RESTOCK_INTEL", desc: "Inventory pulse", icon: RefreshCw, color: "text-emerald-400" },
                                    { id: "SALES", label: "DEALER_STOCK", desc: "Global sales info", icon: Package, color: "text-amber-400" }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedIngestTerminal(t.id as any)}
                                        className={`p-5 rounded-2xl text-left transition-all border group relative overflow-hidden flex flex-col justify-between aspect-square md:aspect-auto md:h-32 ${
                                            selectedIngestTerminal === t.id 
                                            ? "bg-indigo-600/20 border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl shadow-indigo-500/20" 
                                            : "bg-black/40 border-brand-border hover:border-gray-600"
                                        }`}
                                    >
                                        <div className="absolute -top-2 -right-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                            <t.icon className="w-16 h-16" />
                                        </div>
                                        <div className="z-10">
                                            <div className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${selectedIngestTerminal === t.id ? t.color : "text-gray-600"}`}>{t.label}</div>
                                            <div className="text-[9px] text-gray-500 leading-tight italic font-mono opacity-60">{t.desc}</div>
                                        </div>
                                        <div className="flex justify-between items-end z-10">
                                            <Activity className={`w-4 h-4 ${selectedIngestTerminal === t.id ? t.color : "text-gray-800"}`} />
                                            {selectedIngestTerminal === t.id && (
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_12px] animate-pulse ${
                                                    t.id === 'TCG_LOTTERY' ? 'bg-indigo-500 shadow-indigo-500' :
                                                    t.id === 'BONBON' ? 'bg-rose-500 shadow-rose-500' :
                                                    t.id === 'TCG_RESTOCK' ? 'bg-emerald-500 shadow-emerald-500' :
                                                    'bg-amber-500 shadow-amber-500'
                                                }`} />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                            {/* Contextual Management Layer */}
                            {selectedIngestTerminal && (
                                <div className="pt-10 mt-4 border-t border-white/[0.03] space-y-10 animate-in fade-in slide-in-from-top-6 duration-700">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        {/* Left Side: Node Index Management */}
                                        <div className="space-y-8">
                                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
                                                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                                    <Layers className="w-5 h-5" />
                                                    <span>{selectedIngestTerminal}_INDEX_PROTOCOL</span>
                                                </h3>
                                                <div className="px-3 py-1 bg-indigo-500/10 rounded-full text-[8px] text-indigo-400 font-mono font-bold border border-indigo-500/20 uppercase tracking-widest">Management_Active</div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-8">
                                                {(selectedIngestTerminal === "TCG_LOTTERY" || selectedIngestTerminal === "TCG_RESTOCK") ? (
                                                    <>
                                                        <div className="space-y-4">
                                                            <div className="text-[10px] text-gray-500 font-mono uppercase font-black flex justify-between px-1">
                                                                <span>Deploy_Intelligence_Node</span>
                                                                <span className="text-indigo-500 cursor-pointer hover:text-white transition-colors" onClick={() => { setNewCatName(""); setSelectedCategoryId(""); setSelectedSetId(""); }}>Clear_Cache</span>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <input 
                                                                    type="text"
                                                                    value={newCatName}
                                                                    onChange={e => setNewCatName(e.target.value)}
                                                                    className="flex-grow bg-black/60 border border-brand-border rounded-xl px-5 py-4 text-sm text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono placeholder:text-gray-800"
                                                                    placeholder="NEW_TERMINAL_ID (e.g. Disney Lorcana)"
                                                                />
                                                                <button 
                                                                    onClick={createCategory}
                                                                    className="px-8 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-[11px] font-black rounded-xl uppercase hover:bg-indigo-600/30 transition-all shadow-xl shadow-indigo-600/10"
                                                                >
                                                                    Deploy
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 pt-6 border-t border-white/[0.03]">
                                                            <div className="text-[10px] text-gray-500 font-mono uppercase font-black px-1">Sub-Collection / Set_Expansion</div>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                <select 
                                                                    value={selectedCategoryId}
                                                                    onChange={e => setSelectedCategoryId(e.target.value)}
                                                                    className="w-full bg-black/60 border border-brand-border rounded-xl px-5 py-4 text-sm text-indigo-400 font-mono cursor-pointer focus:border-indigo-500 transition-all"
                                                                >
                                                                    <option value="">-- ATTACH_TO_PARENT_NODE --</option>
                                                                    {tcgCategories.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex gap-3">
                                                                    <input 
                                                                        type="text"
                                                                        value={newSetName}
                                                                        onChange={e => setNewSetName(e.target.value)}
                                                                        className="flex-grow bg-black/60 border border-brand-border rounded-xl px-5 py-4 text-sm text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono placeholder:text-gray-800"
                                                                        placeholder="EXPANSION_CODE_NAME..."
                                                                        disabled={!selectedCategoryId}
                                                                    />
                                                                    <button 
                                                                        onClick={createSet}
                                                                        disabled={!selectedCategoryId}
                                                                        className="px-8 py-2 bg-[#1a1a1c] border border-brand-border text-white text-[11px] font-black rounded-xl uppercase hover:bg-white/[0.05] disabled:opacity-20 transition-all shadow-xl"
                                                                    >
                                                                        Inject
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="p-8 bg-black/20 border border-brand-border rounded-2xl text-center space-y-4">
                                                        <Activity className="w-8 h-8 text-gray-800 mx-auto" />
                                                        <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                                                            {selectedIngestTerminal} Indexing is managed via global source monitors.
                                                        </div>
                                                        <button 
                                                            onClick={() => setActiveTab('sources')}
                                                            className="text-[9px] font-black text-brand-accent hover:text-white transition-all uppercase"
                                                        >
                                                            Configure Sources
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side: Visual Database Explorer */}
                                        <div className="space-y-8 bg-black/40 rounded-[2rem] p-8 border border-white/[0.03] shadow-inner">
                                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
                                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                                    <Activity className="w-5 h-5" />
                                                    <span>{selectedIngestTerminal}_DB_EXPLORER</span>
                                                </h3>
                                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">DB_SYNC_OK</span>
                                                </div>
                                            </div>

                                            {(selectedIngestTerminal === "TCG_LOTTERY" || selectedIngestTerminal === "TCG_RESTOCK") ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    {tcgCategories.map(c => (
                                                        <button
                                                            key={c.id}
                                                            className={`relative p-4 rounded-xl border text-left transition-all group overflow-hidden ${
                                                                selectedCategoryId === c.id 
                                                                ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/5" 
                                                                : "bg-[#0b0b0d] border-brand-border hover:border-gray-700"
                                                            }`}
                                                            onClick={() => {
                                                                setSelectedCategoryId(c.id);
                                                                setSelectedSetId("");
                                                            }}
                                                        >
                                                            <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${selectedCategoryId === c.id ? "text-indigo-400" : "text-gray-700"}`}>Terminal_Node</div>
                                                            <div className={`text-[11px] font-bold leading-tight line-clamp-1 ${selectedCategoryId === c.id ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>{c.name.toUpperCase()}</div>
                                                            
                                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {pendingDeleteCategoryId === c.id ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deleteCategory(c.id); }}
                                                                        className="px-2 py-0.5 text-[8px] font-black uppercase bg-rose-500 text-white rounded hover:bg-rose-600 transition-all"
                                                                    >
                                                                        CONFIRM
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setPendingDeleteCategoryId(c.id); }}
                                                                        className="p-1.5 bg-black/80 rounded-lg text-gray-600 hover:text-rose-500 border border-white/[0.05] transition-all"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 bg-black/10 border border-brand-border rounded-xl text-center">
                                                    <div className="text-[10px] text-gray-700 font-mono italic">
                                                        No visual collection index for {selectedIngestTerminal} node.
                                                    </div>
                                                </div>
                                            )}

                                            {selectedCategoryId && (selectedIngestTerminal === "TCG_LOTTERY" || selectedIngestTerminal === "TCG_RESTOCK") && (
                                                <div className="mt-6 pt-6 border-t border-white/[0.05] animate-in fade-in duration-500">
                                                    <div className="text-[9px] text-gray-600 font-mono uppercase font-black mb-4 px-1">Sub-Collection Index: {tcgCategories.find(c => c.id === selectedCategoryId)?.name}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {tcgCategories.find(c => c.id === selectedCategoryId)?.sets?.map((s: any) => (
                                                            <div key={s.id} className="relative group/set">
                                                                <button 
                                                                    onClick={() => setSelectedSetId(s.id)}
                                                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border font-mono uppercase pr-10 ${
                                                                        selectedSetId === s.id 
                                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20" 
                                                                        : "bg-black border-brand-border text-gray-500 hover:text-gray-300"
                                                                    }`}
                                                                >
                                                                    {s.setName}
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); deleteSet(selectedCategoryId, s.id); }}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/set:opacity-100 p-1 text-gray-600 hover:text-rose-500 transition-all"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button 
                                                            onClick={() => setSelectedSetId("")}
                                                            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border font-mono uppercase ${
                                                                !selectedSetId 
                                                                ? "bg-white/10 border-white/20 text-white" 
                                                                : "bg-black/40 border-brand-border text-gray-700 hover:text-gray-500"
                                                            }`}
                                                        >
                                                            GLOBAL_UNSET
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}


                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">System Intelligence Logs</h3>
                                <button onClick={() => setLogs([])} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase">Clear Session</button>
                            </div>
                            <div className="bg-black border border-brand-border rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar shadow-inner">
                                {logs.length === 0 ? (
                                    <div className="text-gray-700 italic">No activity logs in current session... awaiting ingestion.</div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className={`pb-1 border-b border-white/[0.02] ${log.includes('[ERROR]') ? 'text-rose-500' : log.includes('[SYSTEM]') ? 'text-indigo-400' : 'text-gray-500'}`}>
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-brand-accent" />
                                    <span>Raw Intelligence Feed</span>
                                </h3>
                                <div className="text-[10px] text-gray-600 font-mono italic">QUEUE_DEPTH: {rawDocuments.length}</div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                {rawDocuments.length === 0 ? (
                                    <div className="p-8 bg-black/40 border border-dashed border-brand-border rounded-xl text-center">
                                        <div className="text-[10px] text-gray-700 uppercase font-black tracking-widest">No intelligence cached. Run discovery to ingest data.</div>
                                    </div>
                                ) : (
                                    rawDocuments.map(doc => (
                                        <div key={doc.id} className="bg-[#0e0e11] border border-brand-border rounded-xl p-5 hover:border-gray-700 transition-all group">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                        <Activity className="w-4 h-4 text-indigo-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-white font-bold uppercase tracking-tight">{doc.source?.sourceName || "Manual_Ingest"}</div>
                                                        <div className="text-[8px] text-gray-600 font-mono uppercase">{new Date(doc.fetchedAt).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                                <a href={doc.fetchedUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                            
                                            <div className="bg-black/50 rounded-lg p-4 mb-4 font-mono text-[9px] text-gray-500 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar border border-white/[0.02]">
                                                {doc.textContent.slice(0, 500)}...
                                            </div>
                                            
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex gap-2">
                                                    <button 
                                                        className="px-3 py-1.5 bg-[#1a1a1c] border border-brand-border text-gray-500 rounded text-[9px] font-bold uppercase transition-all hover:text-white"
                                                        onClick={() => deleteRawDocument(doc.id)}
                                                    >
                                                        Discard_Cache
                                                    </button>
                                                    <button 
                                                        className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 rounded text-[9px] font-black uppercase transition-all hover:bg-indigo-600/30 flex items-center gap-2"
                                                        onClick={() => {
                                                            setSelectedRawDoc(doc);
                                                            setShowSyncModal(true);
                                                        }}
                                                    >
                                                        <Zap className="w-3 h-3" />
                                                        <span>Sync_to_Terminal</span>
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-gray-700 font-mono tracking-tighter">
                                                    HASH::{doc.checksum}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'design' && (
                    <DesignEngine />
                )}
            </div>

            {showManualForm && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
                    <div className="bg-[#0b0b0d] border border-brand-border rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-brand-border bg-gradient-to-r from-indigo-500/10 to-transparent flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                    <div className="p-2 bg-brand-accent rounded-lg">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span>Manual Ingestion Protocol</span>
                                        <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Target_Node::{selectedIngestTerminal}</span>
                                    </div>
                                </h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex bg-black border border-brand-border rounded-xl p-1">
                                    {[
                                        { id: "TCG_LOTTERY", label: "Lottery" },
                                        { id: "TCG_RESTOCK", label: "Restock" },
                                        { id: "SALES", label: "Sales" },
                                        { id: "BONBON", label: "Bonbon" }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedIngestTerminal(t.id)}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedIngestTerminal === t.id ? "bg-brand-accent text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setShowManualForm(false)} className="text-gray-500 hover:text-white p-2 transition-colors">
                                    <XCircle className="w-8 h-8" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Left Side: Context-Aware Manual Form */}
                                <div className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-px flex-grow bg-brand-accent/30" />
                                            <div className="text-[10px] font-black text-brand-accent uppercase tracking-[0.3em] whitespace-nowrap">Node Parameters</div>
                                            <div className="h-px flex-grow bg-brand-accent/30" />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Package className="w-3 h-3" />
                                                    <span>Product_Name</span>
                                                </label>
                                                <input 
                                                    value={manualEvent.productName}
                                                    onChange={e => setManualEvent({...manualEvent, productName: e.target.value})}
                                                    className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-sm text-white focus:border-brand-accent transition-all placeholder:text-gray-800"
                                                    placeholder={selectedIngestTerminal === "BONBON" ? "Bonbon Drop Name..." : "Expansion Name..."}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Store className="w-3 h-3" />
                                                    <span>Store_Origin</span>
                                                </label>
                                                <input 
                                                    value={manualEvent.storeName}
                                                    onChange={e => setManualEvent({...manualEvent, storeName: e.target.value})}
                                                    className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-sm text-white focus:border-brand-accent transition-all placeholder:text-gray-800"
                                                    placeholder="Target Store Name..."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <Globe className="w-3 h-3" />
                                                <span>Target_URL</span>
                                            </label>
                                            <input 
                                                value={manualEvent.sourceUrl}
                                                onChange={e => setManualEvent({...manualEvent, sourceUrl: e.target.value})}
                                                className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-xs text-indigo-400 font-mono focus:border-brand-accent transition-all placeholder:text-gray-800"
                                                placeholder="https://..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <ExternalLink className="w-3 h-3" />
                                                <span>Poster_Image_URL</span>
                                            </label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    value={manualEvent.imageUrl}
                                                    onChange={e => setManualEvent({...manualEvent, imageUrl: e.target.value})}
                                                    className="flex-1 bg-black/60 border border-brand-border rounded-xl p-4 text-xs text-brand-accent font-mono focus:border-brand-accent transition-all placeholder:text-gray-800"
                                                    placeholder="https://... or upload"
                                                />
                                                <ImageUploadButton onUpload={url => setManualEvent({...manualEvent, imageUrl: url})} />
                                            </div>
                                            {manualEvent.imageUrl && (
                                                <img
                                                    src={manualEvent.imageUrl}
                                                    alt="Preview"
                                                    className="h-20 w-auto rounded-lg object-cover border border-brand-border"
                                                    onError={e => (e.currentTarget.style.display = "none")}
                                                />
                                            )}
                                        </div>                                        {/* Specialized Fields based on Ingest Node */}
                                        {selectedIngestTerminal === "TCG_LOTTERY" && (
                                            <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-500">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">App_Start</label>
                                                    <input 
                                                        type="datetime-local"
                                                        value={manualEvent.applicationStart}
                                                        onChange={e => setManualEvent({...manualEvent, applicationStart: e.target.value})}
                                                        className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-xs text-white focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">App_End</label>
                                                    <input 
                                                        type="datetime-local"
                                                        value={manualEvent.applicationEnd}
                                                        onChange={e => setManualEvent({...manualEvent, applicationEnd: e.target.value})}
                                                        className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-xs text-white focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {(selectedIngestTerminal === "TCG_RESTOCK" || selectedIngestTerminal === "SALES") && (
                                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-500">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Activity className="w-3 h-3" />
                                                        <span>Inventory_Status</span>
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {["AVAILABLE", "UNAVAILABLE", "NO_INFO"].map(s => (
                                                            <button
                                                                key={s}
                                                                onClick={() => setManualEvent({...manualEvent, inventoryStatus: s})}
                                                                className={`py-3 rounded-xl text-[9px] font-black border transition-all ${manualEvent.inventoryStatus === s ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10" : "bg-black border-brand-border text-gray-700 hover:border-gray-600"}`}
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedIngestTerminal === "BONBON" && (
                                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-500">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Drop_Timestamp</label>
                                                    <input 
                                                        type="datetime-local"
                                                        value={manualEvent.applicationStart}
                                                        onChange={e => setManualEvent({...manualEvent, applicationStart: e.target.value})}
                                                        className="w-full bg-black/60 border border-brand-border rounded-xl p-4 text-xs text-white focus:border-rose-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Intelligence_Notes</label>
                                            <textarea 
                                                value={manualEvent.notes}
                                                onChange={e => setManualEvent({...manualEvent, notes: e.target.value})}
                                                className="w-full h-32 bg-black/60 border border-brand-border rounded-2xl p-5 text-sm text-white resize-none focus:border-brand-accent transition-all placeholder:text-gray-800"
                                                placeholder={selectedIngestTerminal === "SALES" ? "Specify stock info, pricing, or regional availability..." : "Additional extraction context..."}
                                            />
                                        </div>

                                        <button 
                                            onClick={handleCreateManualEvent}
                                            disabled={!manualEvent.productName || !manualEvent.storeName || isExtracting}
                                            className="w-full py-5 bg-brand-accent hover:opacity-90 disabled:opacity-30 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-4"
                                        >
                                            {isExtracting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                            <span>Commit Intelligence to Database</span>
                                        </button>
                                    </div>
                                </div>


                                {/* Right Side: Intelligent Extraction */}
                                <div className="space-y-8 bg-black/20 rounded-3xl p-8 border border-white/[0.02]">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-px flex-grow bg-indigo-500/30" />
                                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] whitespace-nowrap">Neural Mapping</div>
                                            <div className="h-px flex-grow bg-indigo-500/30" />
                                        </div>
                                        
                                        <div className="relative">
                                            <textarea 
                                                value={manualText}
                                                onChange={e => setManualText(e.target.value)}
                                                className="w-full h-[450px] bg-black/80 border border-brand-border rounded-[2rem] p-8 text-xs text-indigo-100 font-mono leading-relaxed resize-none focus:border-indigo-500/50 transition-all placeholder:text-gray-800 custom-scrollbar"
                                                placeholder="Paste raw text, HTML snippets, or translated content here. AI will attempt to map fields automatically..."
                                            />
                                            <div className="absolute top-6 right-6 animate-pulse">
                                                <Zap className="w-5 h-5 text-indigo-500/30" />
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={handleManualIngest}
                                            disabled={!manualText.trim() || isExtracting}
                                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-xl shadow-indigo-600/20"
                                        >
                                            {isExtracting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Synthesizing Layers...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Cpu className="w-5 h-5" />
                                                    <span>Execute Neural Extraction</span>
                                                </>
                                            )}
                                        </button>
                                        
                                        <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-4">
                                            <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-gray-500 leading-relaxed uppercase font-black tracking-wider">
                                                Neural Engine identifies dates, stock availability, and entities across multi-language source text using vision-aware models.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSourceForm && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                    <div className="bg-[#0e0e11] border border-brand-border rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-brand-border bg-white/[0.02] flex justify-between items-center">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <Globe className="w-5 h-5 text-brand-accent" />
                                <span>{editingSource ? "Edit Source Node" : "Deploy New Intelligence Node"}</span>
                            </h3>
                            <button onClick={() => setShowSourceForm(false)} className="text-gray-500 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Node Alias</label>
                                    <input 
                                        value={newSource.sourceName}
                                        onChange={e => setNewSource({...newSource, sourceName: e.target.value})}
                                        className="w-full bg-black border border-brand-border rounded p-3 text-xs text-white"
                                        placeholder="e.g. Pokemon Center Japan"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Node Type</label>
                                    <select 
                                        value={newSource.sourceType}
                                        onChange={e => setNewSource({...newSource, sourceType: e.target.value as any})}
                                        className="w-full bg-black border border-brand-border rounded p-3 text-xs text-white"
                                    >
                                        <option value="SCRAPE">WEB_CRAWL (General)</option>
                                        <option value="RSS">RSS_STREAM</option>
                                        <option value="SITEMAP">SITEMAP_INDEX</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Base Domain / Target URL</label>
                                <input 
                                    value={newSource.domain}
                                    onChange={e => setNewSource({...newSource, domain: e.target.value})}
                                    className="w-full bg-black border border-brand-border rounded p-3 text-xs text-white font-mono"
                                    placeholder="https://example.com"
                                />
                            </div>

                            {newSource.sourceType === "RSS" && (
                                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-[9px] font-bold text-rose-400 uppercase tracking-widest font-mono">RSS Feed URL</label>
                                    <input 
                                        value={newSource.rssUrl}
                                        onChange={e => setNewSource({...newSource, rssUrl: e.target.value})}
                                        className="w-full bg-black border border-brand-border rounded p-3 text-xs text-white font-mono"
                                        placeholder="https://example.com/feed.xml"
                                    />
                                </div>
                            )}

                            {newSource.sourceType === "SITEMAP" && (
                                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Sitemap URL</label>
                                    <input 
                                        value={newSource.sitemapUrl}
                                        onChange={e => setNewSource({...newSource, sitemapUrl: e.target.value})}
                                        className="w-full bg-black border border-brand-border rounded p-3 text-xs text-white font-mono"
                                        placeholder="https://example.com/sitemap.xml"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.05]">
                                <button 
                                    onClick={() => setShowSourceForm(false)}
                                    className="w-full py-3 bg-[#1a1a1c] border border-brand-border text-gray-500 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white/[0.02]"
                                >
                                    Abort Deployment
                                </button>
                                <button 
                                    onClick={editingSource ? () => updateSource(editingSource.id, newSource) : createSource}
                                    className="w-full py-3 bg-brand-accent text-white rounded text-[10px] font-bold uppercase tracking-widest hover:opacity-90 shadow-xl shadow-brand-accent/20"
                                >
                                    {editingSource ? "Update Node" : "Deploy Node"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSyncModal && selectedRawDoc && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
                    <div className="bg-[#0e0e11] border border-brand-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-brand-border bg-indigo-500/5 flex justify-between items-center">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <RefreshCw className="w-5 h-5 text-indigo-400" />
                                <span>Sync Intelligence to Terminal</span>
                            </h3>
                            <button onClick={() => setShowSyncModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-black/50 border border-brand-border rounded-xl space-y-3">
                                <div className="text-[10px] text-gray-500 font-mono uppercase font-black">Target Intelligence Node</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold text-xs uppercase">
                                        {selectedRawDoc.source?.sourceName?.charAt(0) || "M"}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white uppercase">{selectedRawDoc.source?.sourceName || "Manual_Ingest"}</div>
                                        <div className="text-[9px] text-gray-600 font-mono italic truncate max-w-[200px]">{selectedRawDoc.fetchedUrl}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="text-[10px] text-gray-500 font-mono uppercase font-black">Destination Terminal</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "TCG_LOTTERY", label: "TCG_LOTTERY" },
                                        { id: "BONBON", label: "BONBON" },
                                        { id: "TCG_RESTOCK", label: "RESTOCK" },
                                        { id: "SALES", label: "SALES" }
                                    ].map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => setSelectedIngestTerminal(t.id)}
                                            className={`p-3 rounded-lg border text-[10px] font-black uppercase transition-all ${
                                                selectedIngestTerminal === t.id 
                                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.15)]" 
                                                : "bg-black border-brand-border text-gray-600 hover:border-gray-700"
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-3">
                                <Search className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-gray-500 leading-relaxed uppercase font-bold tracking-wider">
                                    AI Extraction engine will analyze this document and attempt to create TCG events automatically in the selected terminal.
                                </p>
                            </div>
                            
                            <button 
                                onClick={async () => {
                                    setIsExtracting(true);
                                    setShowSyncModal(false);
                                    addLog(`[SYSTEM] Syncing document ${selectedRawDoc.id} to ${selectedIngestTerminal}...`);
                                    try {
                                        const res = await fetch(`${API_BASE_URL}/api/raw-documents/${selectedRawDoc.id}/sync`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ category: selectedIngestTerminal })
                                        });
                                        const data = await res.json();
                                        addLog(`[SYSTEM] Sync complete: ${data.events?.length || 0} events mapped.`);
                                        fetchStats();
                                        fetchLotteries();
                                    } catch (e) {
                                        addLog("[ERROR] Sync engine failure.");
                                    } finally {
                                        setIsExtracting(false);
                                    }
                                }}
                                disabled={isExtracting}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                            >
                                {isExtracting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                <span>COMMENCE_SYNC_PROTOCOL</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </main>
            </div>
        </ErrorBoundary>
    );
};

// End of component
