import axios from "axios";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { prisma } from "../lib/db.js";

const rssParser = new Parser();

const http = axios.create({
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
    },
    timeout: 30000,
    maxRedirects: 5,
});

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 2000): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            last = e;
            if (attempt < retries) await sleep(baseDelay * Math.pow(2, attempt));
        }
    }
    throw last;
}

async function runConcurrent<T>(
    tasks: Array<() => Promise<T>>,
    concurrency = 3,
    batchDelay = 1500
): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency);
        const settled = await Promise.allSettled(batch.map(t => t()));
        for (const r of settled) {
            results.push(r.status === "fulfilled" ? r.value : ({ status: "FAILED", error: String((r as PromiseRejectedResult).reason) } as T));
        }
        if (i + concurrency < tasks.length) await sleep(batchDelay);
    }
    return results;
}

function makeChecksum(url: string, content: string): string {
    return Buffer.from(`${url}::${content.slice(0, 120)}`).toString("base64").slice(0, 48);
}

function decodeBuffer(buffer: Buffer): string {
    const utf8 = new TextDecoder("utf-8").decode(buffer);
    const charsetMatch = utf8.match(/<meta[^>]*charset=["']?(shift[_-]?jis|sjis|euc-jp|iso-2022-jp)["']?/i);
    if (charsetMatch) {
        const enc = charsetMatch[1].toLowerCase()
            .replace("sjis", "shift_jis")
            .replace("shift-jis", "shift_jis");
        try {
            return new TextDecoder(enc).decode(buffer);
        } catch (_) { /* fall through */ }
    }
    return utf8;
}

function extractText($: cheerio.CheerioAPI): string {
    $("script, style, nav, footer, header, aside, noscript").remove();
    const main = $("main, article, #content, .content, .main, #main").first();
    return (main.length > 0 ? main.text() : $("body").text())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);
}

async function saveIfNew(sourceId: string, url: string, content: string) {
    if (!content.trim()) return;
    const checksum = makeChecksum(url, content);
    const exists = await prisma.rawDocument.findFirst({ where: { checksum } });
    if (!exists) {
        await prisma.rawDocument.create({
            data: { sourceId, fetchedUrl: url, textContent: content, checksum }
        });
    }
}

async function scrapeSource(source: any): Promise<{ source: string; status: string; error?: string }> {
    return withRetry(async () => {
        if (source.sourceType === "RSS" && source.rssUrl) {
            const url = source.rssUrl.startsWith("http") ? source.rssUrl : `https://${source.rssUrl}`;
            const { data: xml } = await http.get<string>(url);
            const feed = await rssParser.parseString(xml);
            for (const item of feed.items) {
                const content = item.contentSnippet || item.content || item.title || "";
                await saveIfNew(source.id, item.link || url, content);
            }

        } else if (source.sourceType === "SCRAPE") {
            const url = source.domain.startsWith("http") ? source.domain : `https://${source.domain}`;
            const resp = await http.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
            const text = extractText(cheerio.load(decodeBuffer(Buffer.from(resp.data))));
            await saveIfNew(source.id, url, text);

        } else if (source.sourceType === "SITEMAP" && source.sitemapUrl) {
            const sitemapUrl = source.sitemapUrl.startsWith("http") ? source.sitemapUrl : `https://${source.sitemapUrl}`;
            const { data: xml } = await http.get<string>(sitemapUrl);
            const $xml = cheerio.load(xml, { xmlMode: true });
            const locs: string[] = [];
            $xml("url > loc").each((_, el) => {
                const loc = $xml(el).text().trim();
                if (loc) locs.push(loc);
            });
            for (const pageUrl of locs.slice(0, 5)) {
                try {
                    const pageResp = await http.get<ArrayBuffer>(pageUrl, { responseType: "arraybuffer" });
                    const pageText = extractText(cheerio.load(decodeBuffer(Buffer.from(pageResp.data))));
                    await saveIfNew(source.id, pageUrl, pageText);
                } catch (_) { /* skip individual page failures */ }
            }
        }

        await prisma.source.update({
            where: { id: source.id },
            data: { lastCrawledAt: new Date() }
        });

        return { source: source.sourceName, status: "SUCCESS" } as const;
    });
}

export async function scrapeAllSources(
    sourceIds?: string[]
): Promise<Array<{ source: string; status: string; error?: string }>> {
    const where: any = { active: true, NOT: { sourceType: "MANUAL" } };
    if (sourceIds?.length) where.id = { in: sourceIds };
    const sources = await prisma.source.findMany({ where });

    const tasks = sources.map(source => async () => {
        await prisma.source.update({
            where: { id: source.id },
            data: { lastAttemptedAt: new Date() }
        }).catch(() => {});
        try {
            return await scrapeSource(source);
        } catch (error: any) {
            let msg = String(error?.message || error);
            if (error?.isAxiosError && error.response) {
                msg = `HTTP ${error.response.status} ${error.response.statusText}`;
            } else if (error?.isAxiosError && error.request) {
                msg = "No response received";
            }
            console.error(`[Scraper] FAILED ${source.sourceName}: ${msg}`);
            await prisma.source.update({
                where: { id: source.id },
                data: { lastErrorAt: new Date(), lastError: msg.slice(0, 500) }
            }).catch(() => {});
            return { source: source.sourceName, status: "FAILED", error: msg };
        }
    });

    return runConcurrent(tasks, 3);
}
