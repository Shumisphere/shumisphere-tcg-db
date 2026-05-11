export interface HeuristicLottery {
    productName: string;
    storeName: string;
    applicationStart?: string | null;
    applicationEnd?: string | null;
    resultDate?: string | null;
    purchaseStart?: string | null;
    purchaseEnd?: string | null;
    status: string;
    notes: string;
    sourceUrl: string;
    imageUrl?: string | null;
}

export function parseLotteryHeuristically(text: string): HeuristicLottery[] {
    // Split by store emoji OR by blocks that start with a store-like line
    // Robust split: look for common start markers
    const blocks = text.split(/(?=🏬|■|◆|【)/).filter(b => b.trim().length > 5);
    const results: HeuristicLottery[] = [];

    // Attempt to find a global product name at the top
    const productNameMatch = text.match(/(?:ポケモンカード|ポケカ|パック|デッキ|BOX|ボックス|拡張パック|SV\d+[a-z]?)\s*[:：\s]*[「『]?(.*?)[」』]?(\s*(?:BOX|パック|セット))?/i);
    const globalProductName = productNameMatch ? productNameMatch[1] + (productNameMatch[2] || "") : "New Product Release";

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) continue;

        // Clean store name from the first line
        const storeName = lines[0].replace(/[🏬📅🎯🛒🔗✅■◆【】]|（予告）|\(予告\)|：|:/g, '').trim();
        if (storeName.length < 2) continue;

        let applicationStart = null;
        let applicationEnd = null;
        let resultDate = null;
        let purchaseStart = null;
        let purchaseEnd = null;
        let sourceUrl = "";
        let imageUrl = null;
        let notesArr: string[] = [];

        for (const line of lines) {
            // URL extraction
            const urlMatch = line.match(/https?:\/\/[^\s<>"]+/);
            if (urlMatch) {
                if (!sourceUrl) sourceUrl = urlMatch[0];
                if (!imageUrl && urlMatch[0].match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                    imageUrl = urlMatch[0];
                }
            }

            // Date extraction (heuristic for Japanese format M/D or M月D日)
            const dateMatches = line.match(/(\d{1,2})[\/\月](\d{1,2})/g);
            
            if (line.includes('📅') || line.includes('受付') || line.includes('期間') || line.includes('締切')) {
                if (dateMatches) {
                    if (dateMatches.length > 1) {
                         applicationStart = formatYearDate(dateMatches[0]);
                         applicationEnd = formatYearDate(dateMatches[1]);
                    } else {
                         applicationEnd = formatYearDate(dateMatches[0]);
                    }
                }
            } else if (line.includes('🎯') || line.includes('当選') || line.includes('発表')) {
                if (dateMatches) {
                    resultDate = formatYearDate(dateMatches[0]);
                }
            } else if (line.includes('🛒') || line.includes('購入') || line.includes('販売')) {
                if (dateMatches) {
                    purchaseStart = formatYearDate(dateMatches[0]);
                    if (dateMatches.length > 1) {
                        purchaseEnd = formatYearDate(dateMatches[1]);
                    }
                }
            }

            if (line.includes('アプリ') || line.includes('店舗') || line.includes('条件') || line.includes('公式')) {
                notesArr.push(line);
            }
        }

        if (!sourceUrl) {
            if (block.includes('アプリ')) sourceUrl = "(APP_ONLY)";
            else if (block.includes('店頭')) sourceUrl = "(IN_STORE)";
        }

        results.push({
            productName: globalProductName,
            storeName,
            applicationStart,
            applicationEnd,
            resultDate,
            purchaseStart,
            purchaseEnd,
            status: "ACTIVE",
            notes: notesArr.join("; "),
            sourceUrl: sourceUrl || "(EXTRACTED)",
            imageUrl
        });
    }

    // Fallback if no blocks found: treat the whole text as one block
    if (results.length === 0 && text.trim().length > 10) {
        results.push({
            productName: globalProductName,
            storeName: "Manual Source",
            status: "ACTIVE",
            notes: text.slice(0, 200) + "...",
            sourceUrl: "(MANUAL)"
        });
    }

    return results;
}

function formatYearDate(dateStr: string): string {
    const parts = dateStr.split(/[\/\月]/);
    const month = parts[0].padStart(2, '0');
    const day = parts[1].replace('日', '').padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}T00:00:00Z`;
}
