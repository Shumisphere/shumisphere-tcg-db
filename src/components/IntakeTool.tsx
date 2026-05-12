import React, { useState, useEffect } from "react";
import { Zap, RefreshCw, CheckCircle, Loader2, XCircle, Clock, Download } from "lucide-react";
import { API_BASE_URL } from "../config";

interface ParsedData {
    store_name: string | null;
    lottery_date: string | null;
    application_end: string | null;
    result_date: string | null;
    purchase_start: string | null;
    purchase_end: string | null;
    set_name: string | null;
    conditions: string | null;
    link: string | null;
    region: string | null;
}

type FieldKey = keyof ParsedData;

const FIELDS: FieldKey[] = ["store_name", "lottery_date", "application_end", "result_date", "purchase_start", "purchase_end", "set_name", "conditions", "link", "region"];

const FIELD_LABELS: Record<FieldKey, string> = {
    store_name: "Store Name",
    lottery_date: "App Start",
    application_end: "App End",
    result_date: "Winner Ann.",
    purchase_start: "Purchase Start",
    purchase_end: "Purchase End",
    set_name: "TCG Set Name",
    conditions: "Entry Conditions",
    link: "Lottery Link",
    region: "Region / Prefecture",
};

function parseText(text: string): ParsedData {
    const currentYear = new Date().getFullYear();

    const norm = (s: string) =>
        s.replace(/[ \t　]+/g, " ").replace(/[〜～]/g, "~").replace(/：/g, ":").trim();
    const cleanText = norm(text);
    const lines = cleanText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

    const fmt = (y: string | number, m: string | number, d: string | number) =>
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    function extractDates(str: string | null): [string | null, string | null] {
        if (!str) return [null, null];
        const s = str.replace(/[（(][月火水木金土日祝][）)]/g, "").replace(/\d{1,2}:\d{2}/g, "");
        const jpRe = /(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日/g;
        const jpHits = [...s.matchAll(jpRe)];
        if (jpHits.length) {
            const start = fmt(jpHits[0][1] || currentYear, jpHits[0][2], jpHits[0][3]);
            const end = jpHits.length > 1
                ? fmt(jpHits[1][1] || jpHits[0][1] || currentYear, jpHits[1][2], jpHits[1][3])
                : null;
            return [start, end];
        }
        const isoRe = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
        const isoHits = [...s.matchAll(isoRe)];
        if (isoHits.length) {
            const start = fmt(isoHits[0][1], isoHits[0][2], isoHits[0][3]);
            const end = isoHits.length > 1
                ? fmt(isoHits[1][1], isoHits[1][2], isoHits[1][3])
                : null;
            return [start, end];
        }
        return [null, null];
    }

    const val = (label: string): string | null => {
        const re = new RegExp(`${label}[\\s:]*([^\\n\\r]{1,200})`, "i");
        const m = cleanText.match(re);
        return m ? m[1].trim() : null;
    };

    const store_raw = val("対象店舗") || val("実施店舗") || val("取扱店") || val("取扱い店舗") || val("取扱店舗") || val("販売店") || val("店舗名") || val("店舗");
    const app_raw   = val("申込期間") || val("受付期間") || val("応募期間") || val("エントリー期間");
    const res_raw   = val("当選発表") || val("結果発表") || val("発表日") || val("発表");
    const sales_raw = val("販売期間") || val("購入期間") || val("引換期間") || val("お渡し期間");
    const prod_raw  = val("対象商品") || val("商品名") || val("景品") || val("賞品") || val("商品");
    const cond_raw  = val("購入条件") || val("参加条件") || val("応募条件") || val("条件");
    const page_raw  = val("申込ページ") || val("応募ページ") || val("申込URL") || val("応募URL") || val("詳細URL") || val("詳細ページ") || val("URL");

    let [lottery_date, application_end] = extractDates(app_raw);
    let [result_date]                   = extractDates(res_raw);
    let [purchase_start, purchase_end]  = extractDates(sales_raw);

    let store_name: string | null = store_raw || null;
    let set_name: string | null   = prod_raw || null;
    let link: string | null       = page_raw?.match(/https?:\/\/[^\s]+/)?.[0] || null;
    let conditions: string | null = cond_raw || null;

    for (const line of lines) {
        if (!lottery_date && /申込|受付|応募|エントリー|\u{1f4c5}/u.test(line)) {
            const [s, e] = extractDates(line);
            if (s) { lottery_date = s; if (e && !application_end) application_end = e; }
        }
        if (!result_date && /当選発表|結果発表|当選者|\u{1f3af}/u.test(line)) {
            const [s] = extractDates(line);
            if (s) result_date = s;
        }
        if (!purchase_start && /販売|購入|お渡し|引換|\u{1f6d2}/u.test(line)) {
            const [s, e] = extractDates(line);
            if (s) { purchase_start = s; if (e && !purchase_end) purchase_end = e; }
        }
        if (line.includes("~")) {
            const [s, e] = extractDates(line);
            if (/^~/.test(line)) {
                if (s && !application_end) application_end = s;
            } else if (!lottery_date) {
                if (s) { lottery_date = s; if (e && !application_end) application_end = e; }
            }
        }
        if (!application_end && /まで/.test(line) && !/販売|購入|引換|当選|発表/.test(line)) {
            const [s] = extractDates(line);
            if (s) application_end = s;
        }
    }

    if (!link) {
        for (const line of lines) {
            if (/^https?:\/\//.test(line)) { link = line.trim(); break; }
        }
    }
    if (!link) {
        const urlM = cleanText.match(/https?:\/\/[^\s<>"'　」）)\]。、]+/);
        link = urlM ? urlM[0] : null;
    }

    if (!store_name) {
        for (const line of lines) {
            if (/^\u{1F3EC}/u.test(line)) {
                const s = line.replace(/^\u{1F3EC}\s*/u, "").trim();
                if (s) { store_name = s; break; }
            }
        }
    }
    if (!store_name) {
        const storeRe = [
            /(アニメイト|ゲーマーズ|メロンブックス|とらのあな|まんだらけ|らしんばん|コトブキヤ|ホビーステーション|プレミアムバンダイ|ポケモンセンター|ポケモンストア|バンダイナムコ|タカラトミー|バンダイ|キディランド|トイザらス|TSUTAYA|ツタヤ|HMV|ブックオフ|ヨドバシカメラ|ヨドバシ|ビックカメラ|ビック|ジョーシン|ソフマップ|エディオン|ヤマダ電機|コジマ|ケーズデンキ|ファミリーマート|ファミマ|ローソン|セブン-イレブン|セブンイレブン|セブンネット|ドン・キホーテ|ドンキ|ゲオ|GEO|イオン|イトーヨーカドー|Amazon|アマゾン|ラウンドワン|Joshin)[^\s、。，,!！?？\n\r]*/i,
            /カードショップ[　\s]?[\w　-鿿]+/,
            /([A-Za-z][A-Za-z0-9\s&'\-]{2,30})(店|ショップ|store)/i,
        ];
        for (const re of storeRe) {
            const m = cleanText.match(re);
            if (m) { store_name = m[0].trim(); break; }
        }
    }
    if (!store_name) {
        const bracketM = cleanText.match(/[《【〔]([^》】〕]{2,20})[》】〕]/);
        if (bracketM) {
            const inner = bracketM[1].trim();
            if (!/ポケモン|ポケカ|MTG|遊戯王|ワンピース|デジモン|バトル|パック|BOX|お知らせ|新発売/i.test(inner)) {
                store_name = inner;
            }
        }
    }
    if (!store_name) {
        const shopM = cleanText.match(/[一-鿿゠-ヿ]{2,12}(店|ショップ)/);
        if (shopM) store_name = shopM[0].trim();
    }

    if (!set_name) {
        const q = cleanText.match(/[「『]([^」』]{2,40})[」』]/);
        if (q) set_name = q[1].trim();
    }
    if (!set_name) {
        const setRe = [
            /(?:バトルパートナーズ|ステラミラクル|ナイトワンダラー|マスクオブチェンジ|クリムゾンヘイズ|超電ブレイカー|テラスタルフェスex|スカーレット|バイオレット|パラドックス|151|sv\d+[a-z]?)[^\s、。，\n]*/i,
            /Scarlet\s*&?\s*Violet[^\s,!?\n]*/i,
            /Battle\s*Partners[^\s,!?\n]*/i,
            /ONE\s*PIECE\s*(カード|Card)[^\s、。\n]*/i,
            /ワンピースカード[^\s、。\n]*/,
            /ドラゴンボール[^\s、。\n]*/,
            /デジモン[^\s、。\n]*/,
            /([一-鿿゠-ヿ]{2,20})(パック|BOX|ボックス|弾|セット)/,
        ];
        for (const re of setRe) {
            const m = cleanText.match(re);
            if (m) { set_name = m[0].trim(); break; }
        }
    }

    let region: string | null = null;
    if (/online|オンライン|通販|ネット申込/i.test(cleanText)) {
        region = "Online";
    } else {
        const prefs = [
            "北海道","青森","岩手","宮城","秋田","山形","福島",
            "茨城","栃木","群馬","埼玉","千葉","東京","神奈川",
            "新潟","富山","石川","福井","山梨","長野",
            "岐阜","静岡","愛知","三重",
            "滋賀","京都","大阪","兵庫","奈良","和歌山",
            "鳥取","島根","岡山","広島","山口",
            "徳島","香川","愛媛","高知",
            "福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄",
            "渋谷","新宿","池袋","秋葉原","梅田","難波","心斎橋","天王寺","博多","名駅","有楽町","銀座","日本橋",
        ];
        for (const p of prefs) if (cleanText.includes(p)) { region = p; break; }
    }

    if (!conditions) {
        const condLines = lines.filter(
            l =>
                /購入|条件|応募|エントリー|参加|抽選|会員|メンバー|予約|申し込み|フォロー|リツイート|RT|LINE|ライン|Twitter|ツイート/i.test(l) &&
                !/https?:\/\//.test(l) &&
                l.length >= 8 &&
                l.length <= 120
        );
        if (condLines.length) conditions = condLines.slice(0, 3).join(" / ");
    }
    if (!conditions) {
        const condKw = [
            { re: /店頭|来店/,                                        jp: "店頭参加" },
            { re: /購入|お買い上げ|買[いうえ]/,                       jp: "購入必要" },
            { re: /会員|メンバー/,                                    jp: "会員限定" },
            { re: /予約|事前申込|申し込み/,                           jp: "事前申込制" },
            { re: /抽選/,                                             jp: "抽選" },
            { re: /応募|エントリー/,                                  jp: "要応募" },
            { re: /twitter|ツイート|フォロー|リツイート|rt/i,         jp: "Twitter/Xフォロー＆RT" },
            { re: /LINE|ライン/,                                      jp: "LINE登録必要" },
            { re: /オンライン|online|通販/i,                          jp: "オンライン応募" },
        ];
        const matched = condKw.filter(({ re }) => re.test(cleanText)).map(({ jp }) => jp);
        if (matched.length) conditions = matched.join("、");
    }

    return { store_name, lottery_date, application_end, result_date, purchase_start, purchase_end, set_name, conditions, link, region };
}

export const IntakeTool: React.FC = () => {
    const [input, setInput] = useState("");
    const [inputType, setInputType] = useState<"tweet" | "webpage">("tweet");
    const [edited, setEdited] = useState<ParsedData | null>(null);
    const [loading, setLoading] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [category, setCategory] = useState("TCG_LOTTERY");
    const [status, setStatus] = useState<{ type: "success" | "error" | "dupe"; msg: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [tcgCategories, setTcgCategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [selectedSetId, setSelectedSetId] = useState("");

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/tcg-categories`)
            .then(r => r.json())
            .then(setTcgCategories)
            .catch(() => {});
    }, []);

    function extractInfo() {
        if (!input.trim()) return;
        setLoading(true);
        setStatus(null);
        setEdited(null);
        try {
            const parsed = parseText(input);
            const low = input.toLowerCase();
            if (low.includes("bonbon") || low.includes("ステッカー") || low.includes("シール")) setCategory("BONBON");
            else if (low.includes("再販") || low.includes("入荷") || low.includes("restock")) setCategory("TCG_RESTOCK");
            else setCategory("TCG_LOTTERY");
            setEdited({ ...parsed });
        } catch {
            setStatus({ type: "error", msg: "Failed to parse input. Check the text and try again." });
        } finally {
            setLoading(false);
        }
    }

    async function pushToDb() {
        if (!edited) return;
        setPushing(true);
        setStatus(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    store_name: edited.store_name,
                    set_name: edited.set_name,
                    lottery_date: edited.lottery_date,
                    application_end: edited.application_end,
                    result_date: edited.result_date,
                    purchase_start: edited.purchase_start,
                    purchase_end: edited.purchase_end,
                    conditions: edited.conditions,
                    link: edited.link,
                    region: edited.region,
                    category,
                    setId: selectedSetId || null,
                    tcgCategoryId: selectedCategoryId || null,
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Server ${res.status}: ${errText}`);
            }
            const result = await res.json();
            if (result._duplicate) {
                setStatus({ type: "dupe", msg: "Duplicate — this entry already exists in the database." });
            } else {
                setHistory(h => [{ ...edited, _saved: new Date().toLocaleTimeString(), _id: result.id, _cat: category }, ...h.slice(0, 9)]);
                setStatus({ type: "success", msg: `Saved! Event ID: ${result.id?.slice(0, 8) ?? "unknown"}` });
                setInput("");
                setEdited(null);
            }
        } catch (err: any) {
            setStatus({ type: "error", msg: `Push failed: ${err.message}` });
        } finally {
            setPushing(false);
        }
    }

    const inp = "w-full bg-black/60 border border-brand-border rounded-lg px-4 py-3 text-xs text-white focus:border-brand-accent outline-none transition-all font-mono";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Step 1 — Paste input */}
            <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-brand-border bg-[#111114] flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <span className="text-brand-accent font-mono">01</span>
                        <Zap className="w-4 h-4 text-brand-accent" />
                        <span>Paste Intelligence</span>
                    </h3>
                    <div className="flex items-center gap-1 bg-black/60 rounded-lg p-1 border border-brand-border">
                        {(["tweet", "webpage"] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setInputType(t)}
                                className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${inputType === t ? "bg-brand-accent text-white shadow" : "text-gray-500 hover:text-gray-300"}`}
                            >
                                {t === "tweet" ? "𝕏 Tweet" : "⬡ Webpage"}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <textarea
                        className="w-full h-40 bg-black/80 border border-brand-border rounded-xl p-5 text-xs text-indigo-100 font-mono leading-relaxed resize-none focus:border-indigo-500/50 transition-all placeholder:text-gray-800 custom-scrollbar"
                        placeholder={
                            inputType === "tweet"
                                ? "Paste the full tweet text here, including any Japanese text..."
                                : "Paste the webpage announcement or HTML text content here..."
                        }
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button
                        onClick={extractInfo}
                        disabled={loading || !input.trim()}
                        className="w-full py-4 bg-brand-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span>{loading ? "Extracting..." : "Extract Lottery Info"}</span>
                    </button>
                </div>
            </div>

            {/* Step 2 — Review & Edit */}
            {edited && (
                <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-4 border-b border-brand-border bg-[#111114] flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="text-brand-accent font-mono">02</span>
                            <CheckCircle className="w-4 h-4 text-brand-accent" />
                            <span>Review & Edit</span>
                        </h3>
                        <div className="flex items-center gap-1 bg-black/60 rounded-lg p-1 border border-brand-border">
                            {[
                                { id: "TCG_LOTTERY", label: "Lottery" },
                                { id: "TCG_RESTOCK", label: "Restock" },
                                { id: "BONBON", label: "Bonbon" },
                                { id: "SALES", label: "Sales" },
                            ].map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setCategory(c.id)}
                                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${category === c.id ? "bg-brand-accent text-white shadow" : "text-gray-500 hover:text-gray-300"}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {FIELDS.map(field => (
                                <div key={field} className={field === "conditions" || field === "link" ? "md:col-span-2" : ""}>
                                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                                        {FIELD_LABELS[field]}
                                    </label>
                                    {field === "conditions" ? (
                                        <textarea
                                            className={`${inp} h-20`}
                                            value={edited[field] ?? ""}
                                            placeholder="Entry conditions..."
                                            onChange={e => setEdited({ ...edited, [field]: e.target.value || null })}
                                            rows={2}
                                        />
                                    ) : (
                                        <input
                                            className={inp}
                                            value={edited[field] ?? ""}
                                            placeholder={field.includes("date") || field.includes("start") || field.includes("end") ? "YYYY-MM-DD" : `${FIELD_LABELS[field]}...`}
                                            onChange={e => setEdited({ ...edited, [field]: e.target.value || null })}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Category & Set assignment — only for TCG_LOTTERY */}
                        {category === "TCG_LOTTERY" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-brand-border/30">
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                                        TCG Category
                                    </label>
                                    <select
                                        className={`${inp} cursor-pointer`}
                                        value={selectedCategoryId}
                                        onChange={e => { setSelectedCategoryId(e.target.value); setSelectedSetId(""); }}
                                    >
                                        <option value="">— Select Category —</option>
                                        {tcgCategories.map((cat: any) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                                        TCG Set
                                    </label>
                                    <select
                                        className={`${inp} cursor-pointer disabled:opacity-40`}
                                        value={selectedSetId}
                                        onChange={e => setSelectedSetId(e.target.value)}
                                        disabled={!selectedCategoryId}
                                    >
                                        <option value="">— Select Set —</option>
                                        {tcgCategories
                                            .find((c: any) => c.id === selectedCategoryId)
                                            ?.sets?.map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.setName}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setEdited(null)}
                                className="px-6 py-3 bg-[#1a1a1c] border border-brand-border text-gray-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/[0.03] transition-all flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                <span>Clear</span>
                            </button>
                            <button
                                onClick={pushToDb}
                                disabled={pushing || !edited.store_name}
                                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-700/20 flex items-center justify-center gap-3"
                            >
                                {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                <span>{pushing ? "Saving..." : "Save to Database"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status */}
            {status && (
                <div className={`p-4 rounded-xl border text-xs font-mono font-bold flex items-center gap-3 animate-in fade-in duration-300 ${
                    status.type === "success" ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400" :
                    status.type === "dupe"    ? "bg-amber-900/20 border-amber-500/30 text-amber-400" :
                                               "bg-rose-900/20 border-rose-500/30 text-rose-400"
                }`}>
                    {status.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> :
                     status.type === "dupe"    ? <RefreshCw className="w-4 h-4 shrink-0" /> :
                                                <XCircle className="w-4 h-4 shrink-0" />}
                    <span>{status.msg}</span>
                    <button onClick={() => setStatus(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">✕</button>
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="bg-[#0e0e11] border border-brand-border rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-brand-border bg-[#111114] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-accent" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recently Saved</h3>
                        <span className="ml-auto text-[9px] text-gray-600 font-mono">{history.length} entries</span>
                    </div>
                    <div className="divide-y divide-[#1a1a1c]">
                        {history.map((item, i) => (
                            <div key={i} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-white uppercase truncate">{item.store_name || "Unknown Store"}</div>
                                    <div className="text-[10px] text-brand-accent font-mono truncate">{item.set_name || "—"}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] text-gray-500 font-mono">{item.lottery_date || "no date"}</div>
                                    <div className="text-[9px] text-gray-700 font-mono">saved {item._saved}</div>
                                </div>
                                <span className="shrink-0 px-2 py-0.5 rounded bg-[#1a1a1c] border border-brand-border text-gray-500 text-[9px] font-bold uppercase">
                                    {item._cat}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
