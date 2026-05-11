import React, { useState, useEffect } from "react";
import { Database, Edit, Trash2, X, Save, RefreshCw, Check } from "lucide-react";
import { API_BASE_URL } from "../config";

export function DatabaseExplorer() {
    const [lotteries, setLotteries] = useState<any[]>([]);
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingLottery, setEditingLottery] = useState<any | null>(null);
    const [editTcgCategoryId, setEditTcgCategoryId] = useState<string>("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchLotteries = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/lotteries`);
            if (!res.ok) throw new Error("Failed to fetch lotteries");
            const data = await res.json();
            setLotteries(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/tcg-categories`);
            if (!res.ok) return;
            setTcgCategories(await res.json());
        } catch {}
    };

    useEffect(() => {
        fetchLotteries();
        fetchCategories();
    }, []);

    const openEdit = (l: any) => {
        setEditingLottery(l);
        setEditTcgCategoryId(l.set?.tcgCategoryId || l.product?.tcgCategoryId || "");
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/lotteries/${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setLotteries(prev => prev.filter(l => l.id !== id));
            setConfirmDeleteId(null);
        } catch (e: any) {
            setConfirmDeleteId(null);
            alert(e.message);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/api/lotteries/${editingLottery.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingLottery)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setLotteries(prev => prev.map(l => l.id === data.id ? { ...l, ...data } : l));
            setEditingLottery(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/lotteries/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ manuallyVerified: true, status: "ACTIVE" })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to approve");
            setLotteries(prev => prev.map(l => l.id === data.id ? { ...l, ...data } : l));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString();
    };

    const inp = "w-full bg-[#1a1a1c] border border-white/[0.05] rounded-lg px-3 py-2 text-xs text-white focus:border-brand-accent outline-none";
    const label = "block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1";
    const setsForCategory = tcgCategories.find(c => c.id === editTcgCategoryId)?.sets || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-brand-border bg-[#111114] flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-4 h-4 text-brand-accent" />
                        <span>Database Explorer</span>
                    </h3>
                    <button onClick={fetchLotteries} className="p-1.5 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 rounded transition-all">
                        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>

                {error && (
                    <div className="m-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>
                )}

                <div className="overflow-x-auto max-h-[800px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[11px] font-mono whitespace-nowrap md:whitespace-normal">
                        <thead className="bg-black text-[9px] text-gray-500 uppercase tracking-widest border-b border-brand-border font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Product / Set</th>
                                <th className="px-6 py-4">Store</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 hidden lg:table-cell">App Start/End</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1c]">
                            {lotteries.map(l => (
                                <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white uppercase">{l.product?.productName || "Unknown"}</div>
                                        <div className="text-[9px] text-gray-500 truncate max-w-[200px]">{l.set?.setName || "No Set"}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 uppercase font-bold text-[10px]">{l.store?.storeName}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 rounded bg-[#1a1a1c] border border-brand-border text-brand-accent font-bold uppercase text-[9px]">
                                            {l.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                            l.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                            l.status === "UPCOMING" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                                            "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                                        }`}>
                                            {l.status}
                                        </span>
                                        {l.manuallyVerified && <span className="ml-1 text-emerald-500" title="Verified">✓</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 hidden lg:table-cell text-[9px]">
                                        {formatDate(l.applicationStart)} – {formatDate(l.applicationEnd)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {confirmDeleteId === l.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-[9px] text-gray-400 uppercase">Delete?</span>
                                                <button
                                                    onClick={() => handleDelete(l.id)}
                                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold uppercase transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="px-2 py-1 bg-[#2a2a2c] hover:bg-[#3a3a3c] text-gray-400 rounded text-[9px] font-bold uppercase transition-colors"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2 text-gray-600">
                                                {!l.manuallyVerified && (
                                                    <button onClick={() => handleApprove(l.id)} className="p-1 hover:text-emerald-500 transition-colors" title="Approve & Publish">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => openEdit(l)} className="p-1 hover:text-brand-accent transition-colors">
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setConfirmDeleteId(l.id)} className="p-1 hover:text-rose-500 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {lotteries.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">No entries found in database.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingLottery && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
                    <form onSubmit={handleUpdate} className="bg-[#0b0b0d] border border-brand-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-brand-border bg-[#111114] flex justify-between items-center">
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Edit className="w-4 h-4 text-brand-accent" />
                                Edit Entry
                            </h2>
                            <button type="button" onClick={() => setEditingLottery(null)} className="text-gray-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">

                            {/* ── Product / Store ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>Product Name</label>
                                    <input
                                        type="text"
                                        value={editingLottery.productName ?? editingLottery.product?.productName ?? ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, productName: e.target.value })}
                                        className={inp}
                                    />
                                </div>
                                <div>
                                    <label className={label}>Store Name</label>
                                    <input
                                        type="text"
                                        value={editingLottery.storeName ?? editingLottery.store?.storeName ?? ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, storeName: e.target.value })}
                                        className={inp}
                                    />
                                </div>
                            </div>

                            {/* ── TCG Category + Set ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>TCG Category</label>
                                    <select
                                        value={editTcgCategoryId}
                                        onChange={e => {
                                            setEditTcgCategoryId(e.target.value);
                                            setEditingLottery({ ...editingLottery, setId: null });
                                        }}
                                        className={inp}
                                    >
                                        <option value="">— None —</option>
                                        {tcgCategories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Set</label>
                                    <select
                                        value={editingLottery.setId || ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, setId: e.target.value || null })}
                                        className={inp}
                                        disabled={!editTcgCategoryId}
                                    >
                                        <option value="">— No Set —</option>
                                        {setsForCategory.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.setName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ── Status / Type ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>Status</label>
                                    <select
                                        value={editingLottery.status}
                                        onChange={e => setEditingLottery({ ...editingLottery, status: e.target.value })}
                                        className={inp}
                                    >
                                        <option value="UPCOMING">UPCOMING</option>
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="RESULT_PENDING">RESULT PENDING</option>
                                        <option value="CLOSED">CLOSED</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>Type</label>
                                    <select
                                        value={editingLottery.category}
                                        onChange={e => setEditingLottery({ ...editingLottery, category: e.target.value })}
                                        className={inp}
                                    >
                                        <option value="TCG_LOTTERY">TCG LOTTERY</option>
                                        <option value="BONBON">BONBON</option>
                                        <option value="TCG_RESTOCK">TCG RESTOCK</option>
                                        <option value="SALES">SALES</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── Dates ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>App Start (YYYY-MM-DD)</label>
                                    <input
                                        type="text"
                                        value={editingLottery.applicationStart ? editingLottery.applicationStart.split("T")[0] : ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, applicationStart: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        className={inp}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </div>
                                <div>
                                    <label className={label}>App End (YYYY-MM-DD)</label>
                                    <input
                                        type="text"
                                        value={editingLottery.applicationEnd ? editingLottery.applicationEnd.split("T")[0] : ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, applicationEnd: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        className={inp}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>Purchase Start</label>
                                    <input
                                        type="text"
                                        value={editingLottery.purchaseStart ? editingLottery.purchaseStart.split("T")[0] : ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, purchaseStart: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        className={inp}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </div>
                                <div>
                                    <label className={label}>Purchase End</label>
                                    <input
                                        type="text"
                                        value={editingLottery.purchaseEnd ? editingLottery.purchaseEnd.split("T")[0] : ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, purchaseEnd: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        className={inp}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={label}>Result Date</label>
                                    <input
                                        type="text"
                                        value={editingLottery.resultDate ? editingLottery.resultDate.split("T")[0] : ""}
                                        onChange={e => setEditingLottery({ ...editingLottery, resultDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        className={inp}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </div>
                                <div>
                                    <label className={label}>Inventory Status</label>
                                    <select
                                        value={editingLottery.inventoryStatus || "NO_INFO"}
                                        onChange={e => setEditingLottery({ ...editingLottery, inventoryStatus: e.target.value })}
                                        className={inp}
                                    >
                                        <option value="AVAILABLE">AVAILABLE</option>
                                        <option value="UNAVAILABLE">UNAVAILABLE</option>
                                        <option value="NO_INFO">NO INFO</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── URLs ── */}
                            <div>
                                <label className={label}>Source URL</label>
                                <input
                                    type="text"
                                    value={editingLottery.sourceUrl || ""}
                                    onChange={e => setEditingLottery({ ...editingLottery, sourceUrl: e.target.value })}
                                    className={`${inp} font-mono text-brand-accent`}
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className={label}>Image URL</label>
                                <input
                                    type="text"
                                    value={editingLottery.imageUrl || ""}
                                    onChange={e => setEditingLottery({ ...editingLottery, imageUrl: e.target.value })}
                                    className={`${inp} font-mono text-brand-accent`}
                                    placeholder="https://..."
                                />
                            </div>

                            {/* ── Notes ── */}
                            <div>
                                <label className={label}>Notes</label>
                                <textarea
                                    value={editingLottery.notes || ""}
                                    onChange={e => setEditingLottery({ ...editingLottery, notes: e.target.value })}
                                    className={`${inp} h-24 custom-scrollbar`}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-brand-border bg-[#111114] flex justify-end gap-3">
                            <button type="button" onClick={() => setEditingLottery(null)} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white uppercase transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all">
                                <Save className="w-3.5 h-3.5" />
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
