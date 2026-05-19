import React, { useState, useEffect } from "react";
import { Save, XCircle, CheckCircle, Loader2, RefreshCw, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { API_BASE_URL } from "../config";

interface LotteryForm {
    store_name: string; set_name: string; lottery_date: string;
    application_end: string; result_date: string; purchase_start: string;
    purchase_end: string; conditions: string; link: string; region: string;
}

const EMPTY: LotteryForm = {
    store_name: "", set_name: "", lottery_date: "", application_end: "",
    result_date: "", purchase_start: "", purchase_end: "", conditions: "", link: "", region: "",
};

const CATEGORIES = [
    { id: "TCG_LOTTERY", label: "TCG Lottery" },
    { id: "TCG_RESTOCK", label: "Restock" },
    { id: "BONBON", label: "Bonbon" },
    { id: "SWITCH2", label: "Switch 2" },
    { id: "COLLECTIBLES", label: "Collectibles" },
];

// ── Parser (supports tweet + blog table text) ────────────────────────────────
function parseText(text: string): Partial<LotteryForm> {
    const currentYear = new Date().getFullYear();
    const norm = (s: string) => s.replace(/[　\t ]+/g, " ").replace(/[〜～]/g, "~").replace(/：/g, ":").trim();
    const clean = norm(text);
    const lines = clean.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

    const fmt = (y: string | number, m: string | number, d: string | number) =>
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    function extractDate(str: string): string | null {
        const jp = str.match(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日/);
        if (jp) return fmt(jp[1] || currentYear, jp[2], jp[3]);
        const iso = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (iso) return fmt(iso[1], iso[2], iso[3]);
        // slash format like 5/19
        const slash = str.match(/(\d{1,2})\/(\d{1,2})/);
        if (slash) return fmt(currentYear, slash[1], slash[2]);
        return null;
    }

    function extractRange(str: string): [string | null, string | null] {
        const parts = str.split(/[〜~～\-–]/);
        return [extractDate(parts[0] || ""), extractDate(parts[1] || "")];
    }

    const val = (label: string) => {
        const re = new RegExp(`${label}[\\s:：]*([^\\n\\r]{1,200})`, "i");
        return clean.match(re)?.[1]?.trim() ?? null;
    };

    let store_name: string | null = null;
    let set_name: string | null = null;
    let lottery_date: string | null = null;
    let application_end: string | null = null;
    let result_date: string | null = null;
    let purchase_start: string | null = null;
    let purchase_end: string | null = null;
    let conditions: string | null = null;
    let link: string | null = null;
    let region: string | null = null;

    // Dates from labelled sections
    const app_raw = val("受付期間") || val("申込期間") || val("応募期間") || val("受付");
    const res_raw = val("当選発表") || val("結果発表");
    const pur_raw = val("購入期間") || val("販売期間") || val("お渡し期間");

    if (app_raw) { [lottery_date, application_end] = extractRange(app_raw); }
    if (res_raw) { [result_date] = extractRange(res_raw); }
    if (pur_raw) { [purchase_start, purchase_end] = extractRange(pur_raw); }

    // Scan lines for 📅🛒🎯 emojis
    for (const line of lines) {
        if (/📅/.test(line) && !lottery_date) { [lottery_date, application_end] = extractRange(line); }
        if (/🛒/.test(line) && !purchase_start) { [purchase_start, purchase_end] = extractRange(line); }
        if (/🎯/.test(line) && !result_date) { [result_date] = extractRange(line); }
        // 🏬 store blocks
        if (/🏬/.test(line) && !store_name) { store_name = line.replace(/🏬\s*/, "").trim(); }
    }

    // Set name — from 「」 or known set keywords
    const q = clean.match(/[「『]([^」』]{2,40})[」』]/);
    if (q) set_name = q[1].trim();
    if (!set_name) {
        const setRe = /(?:アビスアイ|バトルパートナーズ|ステラミラクル|超電ブレイカー|ロケット団の栄光|インフェルノX|ムニキスゼロ|ニンジャスピナー|ブラックボルト|ホワイトフレア|バトルパートナーズ)/;
        set_name = clean.match(setRe)?.[0] ?? null;
    }

    // Store name
    const storeKw = /(アニメイト|ゲーマーズ|楽天ブックス|Amazon|ビックカメラ|コジマ|ファミマ|セブン|TSUTAYA|ツタヤ|ポケモンセンター|ポケモンカードラウンジ|シーガル|竜のしっぽ|ジラフル|GIRAFULL|トレカプラザ|TCGShop|カードラッシュ|古本市場|ブックオフ)[^\s、。，,\n\r]*/i;
    if (!store_name) store_name = clean.match(storeKw)?.[0]?.trim() ?? null;

    // Link
    const urlM = clean.match(/https?:\/\/[^\s<>"'　」）)\]。、]+/);
    link = urlM?.[0] ?? null;

    // Conditions
    const condKw = val("購入条件") || val("参加条件") || val("条件") || val("エントリー方法");
    conditions = condKw;

    // Region
    if (/online|オンライン|通販/i.test(clean)) region = "Online";
    else {
        const prefs = ["東京","大阪","神奈川","愛知","埼玉","千葉","福岡","北海道","京都","兵庫","静岡","茨城","広島","新潟","千葉"];
        region = prefs.find(p => clean.includes(p)) ?? null;
    }

    return { store_name: store_name ?? "", set_name: set_name ?? "", lottery_date: lottery_date ?? "",
        application_end: application_end ?? "", result_date: result_date ?? "",
        purchase_start: purchase_start ?? "", purchase_end: purchase_end ?? "",
        conditions: conditions ?? "", link: link ?? "", region: region ?? "" };
}

// ── Component ────────────────────────────────────────────────────────────────
export const IntakeTool: React.FC = () => {
    const [form, setForm] = useState<LotteryForm>(EMPTY);
    const [category, setCategory] = useState("TCG_LOTTERY");
    const [pushing, setPushing] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | "dupe"; msg: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [selectedSetId, setSelectedSetId] = useState("");

    // Parser panel
    const [showParser, setShowParser] = useState(false);
    const [rawText, setRawText] = useState("");
    const [parsing, setParsing] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/tcg-categories`)
            .then(r => r.json()).then(setTcgCategories).catch(() => {});
    }, []);

    const setField = (key: keyof LotteryForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));

    function runExtract() {
        if (!rawText.trim()) return;
        setParsing(true);
        setTimeout(() => {
            const parsed = parseText(rawText);
            setForm(f => ({ ...f, ...parsed }));
            // Auto-detect category
            const low = rawText.toLowerCase();
            if (low.includes("bonbon") || low.includes("ステッカー")) setCategory("BONBON");
            else if (low.includes("再販") || low.includes("入荷") || low.includes("restock")) setCategory("TCG_RESTOCK");
            else if (low.includes("collectible") || low.includes("figure") || low.includes("toy") || low.includes("plush") || low.includes("フィギュア") || low.includes("ぬいぐるみ") || low.includes("ホビー")) setCategory("COLLECTIBLES");
            else setCategory("TCG_LOTTERY");
            setParsing(false);
            setShowParser(false);
        }, 300);
    }

    async function pushToDb() {
        if (!form.store_name.trim()) { setStatus({ type: "error", msg: "Store Name is required." }); return; }
        setPushing(true); setStatus(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/ingest`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    store_name: form.store_name || null, set_name: form.set_name || null,
                    lottery_date: form.lottery_date || null, application_end: form.application_end || null,
                    result_date: form.result_date || null, purchase_start: form.purchase_start || null,
                    purchase_end: form.purchase_end || null, conditions: form.conditions || null,
                    link: form.link || null, region: form.region || null,
                    category, setId: selectedSetId || null, tcgCategoryId: selectedCategoryId || null,
                }),
            });
            if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
            const result = await res.json();
            if (result._duplicate) {
                setStatus({ type: "dupe", msg: "Duplicate — entry already exists." });
            } else {
                setHistory(h => [{ ...form, _saved: new Date().toLocaleTimeString(), _cat: category }, ...h.slice(0, 9)]);
                setStatus({ type: "success", msg: `Saved! ID: ${result.id?.slice(0, 8)}` });
                setForm(EMPTY); setRawText(""); setSelectedCategoryId(""); setSelectedSetId("");
            }
        } catch (err: any) {
            setStatus({ type: "error", msg: `Save failed: ${err.message}` });
        } finally { setPushing(false); }
    }

    const inp = "w-full bg-black/60 border border-brand-border rounded-lg px-3 py-2.5 text-xs text-white focus:border-brand-accent outline-none transition-all font-mono placeholder:text-gray-700";

    return (
        <div className="space-y-4 animate-in fade-in duration-300">

            {/* Category Pills */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-1">Type:</span>
                {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${category === c.id ? "bg-brand-accent text-white border-brand-accent shadow-lg shadow-brand-accent/20" : "bg-black/40 border-brand-border text-gray-500 hover:text-white hover:border-gray-600"}`}>
                        {c.label}
                    </button>
                ))}
            </div>

            {/* Quick Fill from Text — collapsible */}
            <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowParser(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-brand-accent" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Quick Fill from Tweet / Blog</span>
                        <span className="text-[9px] text-gray-600 font-mono">paste text to auto-fill fields below</span>
                    </div>
                    {showParser ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {showParser && (
                    <div className="px-4 pb-4 space-y-3 border-t border-brand-border">
                        <textarea
                            className="w-full h-36 mt-3 bg-black/80 border border-brand-border rounded-xl p-4 text-xs text-indigo-100 font-mono leading-relaxed resize-none focus:border-indigo-500/50 transition-all placeholder:text-gray-800 custom-scrollbar"
                            placeholder={"Paste tweet text, blog announcement, or table data here...\n\nSupports:\n• Twitter/X lottery posts (📅🛒🎯 emoji format)\n• Blog table rows (store / date / result columns)\n• Japanese or English text"}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => { setRawText(""); setShowParser(false); }}
                                className="px-4 py-2 bg-[#1a1a1c] border border-brand-border text-gray-500 rounded-lg text-xs font-bold hover:bg-white/[0.03] transition-all">
                                Cancel
                            </button>
                            <button onClick={runExtract} disabled={parsing || !rawText.trim()}
                                className="flex-1 py-2 bg-brand-accent hover:opacity-90 disabled:opacity-30 text-white rounded-lg text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2">
                                {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                <span>{parsing ? "Extracting..." : "Extract & Fill Fields"}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Form */}
            <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl">
                <div className="px-4 py-3 border-b border-brand-border bg-[#111114]">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Lottery Details</h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Name <span className="text-rose-500">*</span></label>
                            <input className={inp} placeholder="e.g. アニメイト 渋谷店" value={form.store_name} onChange={setField("store_name")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Region</label>
                            <input className={inp} placeholder="e.g. 東京, Online" value={form.region} onChange={setField("region")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product / Set Name</label>
                        <input className={inp} placeholder="e.g. アビスアイ" value={form.set_name} onChange={setField("set_name")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">App Start</label>
                            <input type="date" className={inp} value={form.lottery_date} onChange={setField("lottery_date")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">App End</label>
                            <input type="date" className={inp} value={form.application_end} onChange={setField("application_end")} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Winner Announcement</label>
                            <input type="date" className={inp} value={form.result_date} onChange={setField("result_date")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purchase Start</label>
                            <input type="date" className={inp} value={form.purchase_start} onChange={setField("purchase_start")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purchase End</label>
                            <input type="date" className={inp} value={form.purchase_end} onChange={setField("purchase_end")} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entry Conditions</label>
                        <textarea className={`${inp} h-14 resize-none`} placeholder="e.g. 購入必要、会員限定..." value={form.conditions} onChange={setField("conditions")} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Source URL</label>
                        <input className={inp} placeholder="https://..." value={form.link} onChange={setField("link")} />
                    </div>

                    {category === "TCG_LOTTERY" && (
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-brand-border/30">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TCG Category</label>
                                <select className={`${inp} cursor-pointer`} value={selectedCategoryId}
                                    onChange={e => { setSelectedCategoryId(e.target.value); setSelectedSetId(""); }}>
                                    <option value="">— Select Category —</option>
                                    {tcgCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TCG Set</label>
                                <select className={`${inp} cursor-pointer disabled:opacity-40`} value={selectedSetId}
                                    onChange={e => setSelectedSetId(e.target.value)} disabled={!selectedCategoryId}>
                                    <option value="">— Select Set —</option>
                                    {tcgCategories.find((c: any) => c.id === selectedCategoryId)?.sets?.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.setName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { setForm(EMPTY); setSelectedCategoryId(""); setSelectedSetId(""); setStatus(null); }}
                            className="px-5 py-2.5 bg-[#1a1a1c] border border-brand-border text-gray-500 rounded-xl text-xs font-bold uppercase hover:bg-white/[0.03] transition-all flex items-center gap-2">
                            <XCircle className="w-4 h-4" /><span>Clear</span>
                        </button>
                        <button onClick={pushToDb} disabled={pushing || !form.store_name.trim()}
                            className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-700/20 flex items-center justify-center gap-3">
                            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{pushing ? "Saving..." : "Save to Database"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Status */}
            {status && (
                <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-3 animate-in fade-in ${status.type === "success" ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400" : status.type === "dupe" ? "bg-amber-900/20 border-amber-500/30 text-amber-400" : "bg-rose-900/20 border-rose-500/30 text-rose-400"}`}>
                    {status.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : status.type === "dupe" ? <RefreshCw className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    <span>{status.msg}</span>
                    <button onClick={() => setStatus(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-brand-border bg-[#111114] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-accent" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recently Saved</h3>
                        <span className="ml-auto text-[9px] text-gray-600 font-mono">{history.length} entries</span>
                    </div>
                    <div className="divide-y divide-[#1a1a1c]">
                        {history.map((item, i) => (
                            <div key={i} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-white uppercase truncate">{item.store_name || "Unknown Store"}</div>
                                    <div className="text-[10px] text-brand-accent font-mono truncate">{item.set_name || "—"}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] text-gray-500 font-mono">{item.lottery_date || "no date"}</div>
                                    <div className="text-[9px] text-gray-700 font-mono">saved {item._saved}</div>
                                </div>
                                <span className="shrink-0 px-2 py-0.5 rounded bg-[#1a1a1c] border border-brand-border text-gray-500 text-[9px] font-bold uppercase">{item._cat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
