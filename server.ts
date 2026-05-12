import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import Fuse from "fuse.js";
import cron from "node-cron";
import { scrapeAllSources } from "./src/services/scraperService.js";
import { extractLotteryInfo } from "./src/services/geminiService.js";
import { parseLotteryHeuristically } from "./src/services/heuristicParser.js";
import { prisma } from "./src/lib/db.js";
import dotenv from "dotenv";

dotenv.config();

async function fuzzyFindStore(name: string) {
  if (!name) return null;
  const stores = await prisma.store.findMany();
  const fuse = new Fuse(stores, {
    keys: [{ name: "storeName", weight: 2 }, { name: "aliases", weight: 1 }],
    threshold: 0.4,
    includeScore: true,
  });
  const results = fuse.search(name);
  return (results.length > 0 && (results[0].score ?? 1) < 0.4) ? results[0].item : null;
}

async function startServer() {
  try {
    const app = express();
    const PORT = Number(process.env.PORT) || 3000;

    app.use(cors());
    app.use(express.json({ limit: "2mb" }));

    // ──────────────────────────────────────────────────────────────
    // Health
    // ──────────────────────────────────────────────────────────────
    app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

    // ──────────────────────────────────────────────────────────────
    // Stats
    // ──────────────────────────────────────────────────────────────
    app.get("/api/stats", async (_req, res) => {
      try {
        const [totalEvents, activeEvents, totalSources] = await Promise.all([
          prisma.lotteryEvent.count(),
          prisma.lotteryEvent.count({ where: { status: "ACTIVE" } }),
          prisma.source.count(),
        ]);
        res.json({ totalEvents, activeEvents, totalSources });
      } catch {
        res.status(500).json({ error: "Stats unavailable" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Lotteries
    // ──────────────────────────────────────────────────────────────
    function getAutoStatus(event: any) {
      const now = new Date();
      const start = event.applicationStart ? new Date(event.applicationStart) : null;
      const end = event.applicationEnd ? new Date(event.applicationEnd) : null;

      if (end && now > end) return "CLOSED";
      if (start && now < start) return "UPCOMING";
      if (start && (!end || now <= end)) return "ACTIVE";
      return event.status; // Fallback to current status
    }

    app.get("/api/lotteries", async (req, res) => {
      try {
        const { category, tcgCategoryId, set, skip = "0", take = "200" } = req.query;
        const where: any = {};
        if (category) where.category = category as string;
        if (tcgCategoryId) where.product = { tcgCategoryId: tcgCategoryId as string };
        if (set) where.setId = set as string;

        const lotteries = await prisma.lotteryEvent.findMany({
          where,
          include: { product: { include: { tcgCategory: true } }, store: true, set: true },
          orderBy: [
            { applicationStart: "asc" },
            { updatedAt: "desc" }
          ],
          skip: parseInt(skip as string, 10) || 0,
          take: Math.min(parseInt(take as string, 10) || 200, 500),
        });

        // Auto-trigger status updates in response (and optionally in DB)
        const processed = lotteries.map(l => ({
          ...l,
          status: getAutoStatus(l)
        }));

        res.json(processed);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch lotteries" });
      }
    });

    app.post("/api/lotteries", async (req, res) => {
      try {
        const { info, sourceId, url, tcgCategoryId, setId, category, inventoryStatus } = req.body;

        let store = await fuzzyFindStore(info.storeName);
        if (!store) {
          store = await prisma.store.create({ data: { storeName: info.storeName, region: "JP-WIDE" } });
        }

        let product = await prisma.product.findFirst({ where: { productName: { contains: info.productName } } });
        if (!product) {
          product = await prisma.product.create({
            data: { productName: info.productName, tcgCategoryId: tcgCategoryId || null },
          });
        }

        const existingEvent = await prisma.lotteryEvent.findFirst({
          where: { productId: product.id, storeId: store.id, sourceUrl: url || info.sourceUrl },
        });

        if (existingEvent) {
          const updated = await prisma.lotteryEvent.update({
            where: { id: existingEvent.id },
            data: {
              applicationStart: info.applicationStart ? new Date(info.applicationStart) : existingEvent.applicationStart,
              applicationEnd: info.applicationEnd ? new Date(info.applicationEnd) : existingEvent.applicationEnd,
              resultDate: info.resultDate ? new Date(info.resultDate) : existingEvent.resultDate,
              purchaseStart: info.purchaseStart ? new Date(info.purchaseStart) : existingEvent.purchaseStart,
              purchaseEnd: info.purchaseEnd ? new Date(info.purchaseEnd) : existingEvent.purchaseEnd,
              notes: info.notes || existingEvent.notes,
              status: info.status || existingEvent.status,
              setId: setId || existingEvent.setId,
              imageUrl: (info.imageUrl && info.imageUrl.trim() !== "") ? info.imageUrl : existingEvent.imageUrl,
              updatedAt: new Date(),
            },
          });
          return res.json(updated);
        }

        let manualSource = await prisma.source.findFirst({ where: { sourceName: "Manual Ingest" } });
        if (!manualSource) {
          manualSource = await prisma.source.create({
            data: {
              sourceName: "Manual Ingest",
              sourceType: "MANUAL",
              domain: "local://manual-ingest",
              crawlFrequency: 0,
              active: true
            }
          });
        }

        const event = await prisma.lotteryEvent.create({
          data: {
            productId: product.id,
            storeId: store.id,
            sourceId: sourceId || manualSource.id,
            category: category || "TCG_LOTTERY",
            inventoryStatus: inventoryStatus || "NO_INFO",
            status: info.status || "ACTIVE",
            applicationStart: info.applicationStart ? new Date(info.applicationStart) : null,
            applicationEnd: info.applicationEnd ? new Date(info.applicationEnd) : null,
            resultDate: info.resultDate ? new Date(info.resultDate) : null,
            purchaseStart: info.purchaseStart ? new Date(info.purchaseStart) : null,
            purchaseEnd: info.purchaseEnd ? new Date(info.purchaseEnd) : null,
            sourceUrl: url || info.sourceUrl || "(MANUAL)",
            notes: info.notes,
            imageUrl: info.imageUrl,
            setId: setId || null,
            confidenceScore: 0.9,
            manuallyVerified: true,
          },
        });
        res.json(event);
      } catch (error) {
        console.error("Save error:", error);
        res.status(500).json({ error: "Failed to save lottery" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Scraper Ingest  (flat fields from tcg-lottery-tool)
    // POST /api/ingest
    // Body: { store_name, set_name, lottery_date, conditions, link, region }
    // ──────────────────────────────────────────────────────────────
    app.post("/api/ingest", async (req, res) => {
      try {
        const {
          store_name,
          set_name,
          lottery_date,
          application_end,
          result_date,
          purchase_start,
          purchase_end,
          conditions,
          link,
          region,
          category,
          setId,
          tcgCategoryId
        } = req.body;

        // Resolve or create store
        let store = await fuzzyFindStore(store_name || "Unknown Store");
        if (!store) {
          store = await prisma.store.create({
            data: { storeName: store_name || "Unknown Store", region: region || "JP-WIDE" },
          });
        }

        // Resolve or create product
        const productName = set_name || "Unknown Product";
        let product = await prisma.product.findFirst({ where: { productName: { contains: productName } } });
        if (!product) {
          product = await prisma.product.create({ data: { productName, tcgCategoryId: tcgCategoryId || null } });
        } else if (tcgCategoryId && !product.tcgCategoryId) {
          product = await prisma.product.update({ where: { id: product.id }, data: { tcgCategoryId } });
        }

        // Dedup check — update setId/tcgCategoryId on existing event if we now have them
        const existing = await prisma.lotteryEvent.findFirst({
          where: { productId: product.id, storeId: store.id, sourceUrl: link || "(MANUAL)" },
        });
        if (existing) {
          if (setId && !existing.setId) {
            const updated = await prisma.lotteryEvent.update({ where: { id: existing.id }, data: { setId } });
            return res.json({ ...updated, _duplicate: true });
          }
          return res.json({ ...existing, _duplicate: true });
        }

        // Resolve Manual Ingest source
        let manualSource = await prisma.source.findFirst({ where: { sourceName: "Manual Ingest" } });
        if (!manualSource) {
          manualSource = await prisma.source.create({
            data: { sourceName: "Manual Ingest", sourceType: "MANUAL", domain: "local://manual-ingest", crawlFrequency: 0, active: true },
          });
        }

        const event = await prisma.lotteryEvent.create({
          data: {
            productId:        product.id,
            storeId:          store.id,
            sourceId:         manualSource.id,
            category:         category || "TCG_LOTTERY",
            status:           "ACTIVE",
            applicationStart: lottery_date ? new Date(lottery_date) : null,
            applicationEnd:   application_end ? new Date(application_end) : null,
            resultDate:       result_date ? new Date(result_date) : null,
            purchaseStart:    purchase_start ? new Date(purchase_start) : null,
            purchaseEnd:      purchase_end ? new Date(purchase_end) : null,
            sourceUrl:        link || "(MANUAL)",
            notes:            conditions || null,
            region:           region || null,
            setId:            setId || null,
            confidenceScore:  0.95,
            manuallyVerified: false,
            inventoryStatus:  "NO_INFO",
          },
        });

        res.json(event);
      } catch (error: any) {
        console.error("[Ingest] Error:", error);
        res.status(500).json({ error: error.message || "Ingest failed" });
      }
    });

    app.delete("/api/lotteries/:id", async (req, res) => {
      try {
        await prisma.generatedContent.deleteMany({ where: { eventId: req.params.id } });
        await prisma.lotteryEvent.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete lottery error:", error);
        res.status(500).json({ error: error?.message || "Failed to delete lottery" });
      }
    });

    app.patch("/api/lotteries/:id", async (req, res) => {
      try {
        const {
          applicationStart, applicationEnd, resultDate, purchaseStart, purchaseEnd,
          notes, status, inventoryStatus, category, imageUrl, manuallyVerified,
          setId, sourceUrl, productName, storeName
        } = req.body;

        const current = await prisma.lotteryEvent.findUnique({ where: { id: req.params.id } });
        if (!current) return res.status(404).json({ error: "Not found" });

        const data: any = {};
        if (applicationStart !== undefined) data.applicationStart = applicationStart ? new Date(applicationStart) : null;
        if (applicationEnd !== undefined) data.applicationEnd = applicationEnd ? new Date(applicationEnd) : null;
        if (resultDate !== undefined) data.resultDate = resultDate ? new Date(resultDate) : null;
        if (purchaseStart !== undefined) data.purchaseStart = purchaseStart ? new Date(purchaseStart) : null;
        if (purchaseEnd !== undefined) data.purchaseEnd = purchaseEnd ? new Date(purchaseEnd) : null;
        if (notes !== undefined) data.notes = notes;
        if (status !== undefined) data.status = status;
        if (inventoryStatus !== undefined) data.inventoryStatus = inventoryStatus;
        if (category !== undefined) data.category = category;
        if (imageUrl !== undefined) data.imageUrl = imageUrl;
        if (manuallyVerified !== undefined) data.manuallyVerified = manuallyVerified;
        if (setId !== undefined) data.setId = setId || null;
        if (sourceUrl !== undefined) data.sourceUrl = sourceUrl;

        const ops: Promise<any>[] = [
          prisma.lotteryEvent.update({
            where: { id: req.params.id },
            data,
            include: { product: { include: { tcgCategory: true } }, store: true, set: true }
          })
        ];
        if (productName !== undefined && current.productId)
          ops.push(prisma.product.update({ where: { id: current.productId }, data: { productName } }));
        if (storeName !== undefined && current.storeId)
          ops.push(prisma.store.update({ where: { id: current.storeId }, data: { storeName } }));

        const [updated] = await Promise.all(ops);
        if (productName !== undefined && updated.product) updated.product.productName = productName;
        if (storeName !== undefined && updated.store) updated.store.storeName = storeName;

        res.json(updated);
      } catch (error: any) {
        console.error("Update lottery error:", error);
        res.status(500).json({ error: error?.message || "Failed to update lottery" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // TCG Categories & Sets
    // ──────────────────────────────────────────────────────────────
    app.get("/api/tcg-categories", async (_req, res) => {
      const categories = await prisma.tcgCategory.findMany({ include: { sets: true } });
      res.json(categories);
    });

    app.post("/api/tcg-categories", async (req, res) => {
      const { name, tcgPlayerId } = req.body;
      const category = await prisma.tcgCategory.create({
        data: { name, tcgPlayerId: tcgPlayerId ? parseInt(tcgPlayerId) : null },
      });
      res.json(category);
    });

    app.patch("/api/tcg-categories/:id", async (req, res) => {
      const { name, tcgPlayerId } = req.body;
      try {
        const category = await prisma.tcgCategory.update({
          where: { id: req.params.id },
          data: { name, tcgPlayerId: tcgPlayerId ? parseInt(tcgPlayerId) : null },
        });
        res.json(category);
      } catch {
        res.status(500).json({ error: "Failed to update category" });
      }
    });

    app.post("/api/tcg-categories/:categoryId/sets", async (req, res) => {
      const { setName, releaseDate, tcgPlayerId } = req.body;
      const set = await prisma.set.create({
        data: {
          setName,
          tcgCategoryId: req.params.categoryId,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          tcgPlayerId: tcgPlayerId ? parseInt(tcgPlayerId) : null,
        },
      });
      res.json(set);
    });

    app.delete("/api/tcg-categories/:id", async (req, res) => {
      try {
        // Delete children manually first, then parent — Prisma "prisma" relation mode
        // does not always cascade transitively through multi-hop paths (Set→LotteryEvent→GeneratedContent)
        const sets = await prisma.set.findMany({ where: { tcgCategoryId: req.params.id } });
        const products = await prisma.product.findMany({ where: { tcgCategoryId: req.params.id } });
        const setIds = sets.map(s => s.id);
        const productIds = products.map(p => p.id);
        const lotteryEvents = await prisma.lotteryEvent.findMany({
          where: { OR: [{ setId: { in: setIds } }, { productId: { in: productIds } }] },
          select: { id: true },
        });
        const lotteryIds = lotteryEvents.map(e => e.id);
        if (lotteryIds.length > 0) {
          await prisma.generatedContent.deleteMany({ where: { eventId: { in: lotteryIds } } });
          await prisma.lotteryEvent.deleteMany({ where: { id: { in: lotteryIds } } });
        }
        if (productIds.length > 0) await prisma.product.deleteMany({ where: { id: { in: productIds } } });
        if (setIds.length > 0) await prisma.set.deleteMany({ where: { id: { in: setIds } } });
        await prisma.tcgCategory.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete category error:", error);
        res.status(500).json({ error: error.message || "Failed to delete category" });
      }
    });

    app.delete("/api/tcg-categories/:categoryId/sets/:setId", async (req, res) => {
      try {
        const lotteryEvents = await prisma.lotteryEvent.findMany({
          where: { setId: req.params.setId },
          select: { id: true },
        });
        const lotteryIds = lotteryEvents.map(e => e.id);
        if (lotteryIds.length > 0) {
          await prisma.generatedContent.deleteMany({ where: { eventId: { in: lotteryIds } } });
          await prisma.lotteryEvent.deleteMany({ where: { id: { in: lotteryIds } } });
        }
        await prisma.set.delete({ where: { id: req.params.setId } });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete set error:", error);
        res.status(500).json({ error: error.message || "Failed to delete set" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // System Config / Theme
    // ──────────────────────────────────────────────────────────────
    app.get("/api/config", async (_req, res) => {
      try {
        let config = await prisma.systemConfig.findUnique({
          where: { id: "singleton" }
        });

        if (!config) {
          // Initialize default if missing
          config = await prisma.systemConfig.create({
            data: { 
              id: "singleton",
              theme: JSON.stringify({
                primaryColor: "#6366f1",
                backgroundColor: "#0a0a0b",
                headerColor: "#0e0e0f",
                sidebarColor: "#0c0c0d",
                borderColor: "#2a2a2c",
                accentColor: "#6366f1",
                successColor: "#00ff9d",
                fontSans: "Outfit",
                fontMono: "JetBrains Mono",
                cardRadius: "0.75rem",
                glowIntensity: "0.5",
                backgroundImage: ""
              }),
              layout: JSON.stringify({
                sidebarEnabled: true,
                defaultView: 'grid'
              })
            }
          });
        }

        res.json({
          theme: JSON.parse(config.theme),
          layout: JSON.parse(config.layout),
          featuredImage: config.featuredImage ? JSON.parse(config.featuredImage) : null,
          ads: config.ads ? JSON.parse(config.ads) : []
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch config" });
      }
    });

    app.post("/api/config", async (req, res) => {
      try {
        const { theme, layout, featuredImage, ads } = req.body;
        const config = await prisma.systemConfig.upsert({
          where: { id: "singleton" },
          update: {
            theme: JSON.stringify(theme),
            layout: JSON.stringify(layout),
            featuredImage: featuredImage ? JSON.stringify(featuredImage) : undefined,
            ads: ads ? JSON.stringify(ads) : undefined
          },
          create: {
            id: "singleton",
            theme: JSON.stringify(theme),
            layout: JSON.stringify(layout),
            featuredImage: featuredImage ? JSON.stringify(featuredImage) : undefined,
            ads: ads ? JSON.stringify(ads) : undefined
          }
        });

        res.json({
          theme: JSON.parse(config.theme),
          layout: JSON.parse(config.layout),
          featuredImage: config.featuredImage ? JSON.parse(config.featuredImage) : null,
          ads: config.ads ? JSON.parse(config.ads) : []
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to update config" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Sources
    // ──────────────────────────────────────────────────────────────
    app.get("/api/sources", async (_req, res) => {
      const sources = await prisma.source.findMany();
      res.json(sources);
    });

    app.post("/api/sources", async (req, res) => {
      try {
        const { sourceName, sourceType, domain, rssUrl, sitemapUrl, crawlFrequency, active } = req.body;
        const source = await prisma.source.create({
          data: {
            sourceName,
            sourceType,
            domain,
            rssUrl,
            sitemapUrl,
            crawlFrequency: parseInt(crawlFrequency as string || "3600"),
            active: active !== undefined ? active : true,
          },
        });
        res.json(source);
      } catch {
        res.status(500).json({ error: "Failed to create source" });
      }
    });

    app.patch("/api/sources/:id", async (req, res) => {
      try {
        const { sourceName, sourceType, domain, rssUrl, sitemapUrl, crawlFrequency, active } = req.body;
        const source = await prisma.source.update({
          where: { id: req.params.id },
          data: { sourceName, sourceType, domain, rssUrl, sitemapUrl, crawlFrequency: crawlFrequency ? parseInt(crawlFrequency) : undefined, active },
        });
        res.json(source);
      } catch {
        res.status(500).json({ error: "Failed to update source" });
      }
    });

    app.delete("/api/sources/:id", async (req, res) => {
      try {
        const source = await prisma.source.findUnique({ where: { id: req.params.id } });

        const lotteryEvents = await prisma.lotteryEvent.findMany({
          where: { sourceId: req.params.id },
          select: { id: true },
        });
        const lotteryIds = lotteryEvents.map(e => e.id);
        if (lotteryIds.length > 0) {
          await prisma.generatedContent.deleteMany({ where: { eventId: { in: lotteryIds } } });
          await prisma.lotteryEvent.deleteMany({ where: { id: { in: lotteryIds } } });
        }
        await prisma.rawDocument.deleteMany({ where: { sourceId: req.params.id } });
        await prisma.source.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete source error:", error);
        res.status(500).json({ error: error.message || "Failed to delete source" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Scrape
    // ──────────────────────────────────────────────────────────────
    app.post("/api/scrape", async (_req, res) => {
      try {
        const results = await scrapeAllSources();
        res.json({ message: "Scraping completed", results });
      } catch (error) {
        console.error("Scrape error:", error);
        res.status(500).json({ error: "Scraping failed" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Raw Documents
    // ──────────────────────────────────────────────────────────────
    app.get("/api/raw-documents", async (_req, res) => {
      try {
        const docs = await prisma.rawDocument.findMany({
          take: 50,
          orderBy: { fetchedAt: "desc" },
          include: { source: true },
        });
        res.json(docs);
      } catch {
        res.status(500).json({ error: "Failed to fetch documents" });
      }
    });

    app.post("/api/raw-documents", async (req, res) => {
      try {
        const { text, url } = req.body;
        const source = await prisma.source.findFirst({ where: { sourceName: "Manual Ingest" } });
        const doc = await prisma.rawDocument.create({
          data: {
            textContent: text,
            fetchedUrl: url || "(MANUAL_INGEST)",
            sourceId: source?.id || "",
            checksum: Buffer.from(text.slice(0, 50)).toString("base64") + Date.now(),
          },
        });
        res.json(doc);
      } catch {
        res.status(500).json({ error: "Failed to create document" });
      }
    });

    app.delete("/api/raw-documents/:id", async (req, res) => {
      try {
        await prisma.rawDocument.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to delete document" });
      }
    });

    app.post("/api/raw-documents/:id/sync", async (req, res) => {
      try {
        const { category } = req.body;
        const doc = await prisma.rawDocument.findUnique({
          where: { id: req.params.id },
          include: { source: true },
        });
        if (!doc) return res.status(404).json({ error: "Document not found" });

        const geminiResults = await extractLotteryInfo(doc.textContent || "");
        const extracted = geminiResults.length > 0
          ? geminiResults
          : parseLotteryHeuristically(doc.textContent || "");
        const createdEvents = [];

        for (const info of extracted) {
          let store = await fuzzyFindStore(info.storeName);
          if (!store) {
            store = await prisma.store.create({ data: { storeName: info.storeName, region: "JP-WIDE" } });
          }

          let product = await prisma.product.findFirst({ where: { productName: { contains: info.productName } } });
          if (!product) {
            product = await prisma.product.create({ data: { productName: info.productName } });
          }

          const existing = await prisma.lotteryEvent.findFirst({
            where: { productId: product.id, storeId: store.id, sourceUrl: info.sourceUrl || doc.fetchedUrl },
          });

          if (!existing) {
            const event = await prisma.lotteryEvent.create({
              data: {
                productId: product.id,
                storeId: store.id,
                sourceId: doc.sourceId,
                category: category || "TCG_LOTTERY",
                status: info.status || "ACTIVE",
                applicationStart: info.applicationStart ? new Date(info.applicationStart) : null,
                applicationEnd: info.applicationEnd ? new Date(info.applicationEnd) : null,
                resultDate: info.resultDate ? new Date(info.resultDate) : null,
                purchaseStart: info.purchaseStart ? new Date(info.purchaseStart) : null,
                purchaseEnd: info.purchaseEnd ? new Date(info.purchaseEnd) : null,
                sourceUrl: info.sourceUrl || doc.fetchedUrl,
                notes: info.notes,
                imageUrl: info.imageUrl,
                confidenceScore: 0.8,
              },
            });
            createdEvents.push(event);
          }
        }
        res.json({ events: createdEvents });
      } catch (e) {
        console.error("Sync error:", e);
        res.status(500).json({ error: "Sync failed" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Frontend Sync — bumps cacheVersion so clients drop stale cache
    // ──────────────────────────────────────────────────────────────
    app.post("/api/sync-frontend", async (_req, res) => {
      try {
        // Bump cacheVersion so the frontend knows to invalidate sessionStorage caches
        const current = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
        const layout = current ? JSON.parse(current.layout || "{}") : {};
        layout.cacheVersion = (layout.cacheVersion || 0) + 1;
        await prisma.systemConfig.upsert({
          where: { id: "singleton" },
          update: { layout: JSON.stringify(layout) },
          create: { id: "singleton", theme: JSON.stringify({}), layout: JSON.stringify(layout) },
        });

        const hookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;
        if (hookUrl) {
          const response = await fetch(hookUrl, { method: "POST" });
          if (!response.ok) throw new Error(`Deploy hook returned HTTP ${response.status}`);
          return res.json({ success: true, message: "Live sync complete — Cloudflare Pages deployment triggered.", cacheVersion: layout.cacheVersion });
        }

        res.json({ success: true, message: "Live sync complete. New data is immediately available to all visitors.", cacheVersion: layout.cacheVersion });
      } catch (err: any) {
        console.error("[Sync] Error:", err);
        res.status(500).json({ error: err.message || "Sync failed" });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Vite dev / static prod
    // ──────────────────────────────────────────────────────────────
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      try {
        await seedInitialData();
      } catch (err) {
        console.error("[Server] Seed failed:", err);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Auto-scrape: every 15 minutes, crawl sources whose lastCrawledAt is past due
cron.schedule("*/15 * * * *", async () => {
  try {
    const now = new Date();
    const sources = await prisma.source.findMany({
      where: { active: true, NOT: { sourceType: "MANUAL" } },
    });
    const dueIds = sources
      .filter(s => !s.lastCrawledAt || now.getTime() >= s.lastCrawledAt.getTime() + s.crawlFrequency * 1000)
      .map(s => s.id);
    if (dueIds.length === 0) return;
    console.log(`[Cron] Auto-scraping ${dueIds.length} due source(s)`);
    scrapeAllSources(dueIds).catch(e => console.error("[Cron] Scrape error:", e));
  } catch (e) {
    console.error("[Cron] Error checking due sources:", e);
  }
});

async function seedInitialData() {
  // Fix any broken source configs first
  await prisma.source.updateMany({
    where: { sourceName: "Pokemon Center Online", sourceType: "RSS" },
    data: { sourceType: "SCRAPE", domain: "https://www.pokemoncenter-online.com/?main_page=campaign_list", rssUrl: null },
  });
  await prisma.source.updateMany({
    where: { sourceName: "GEO Online" },
    data: { domain: "https://geo-online.co.jp/store_info/service/lottery/" },
  });
  await prisma.source.updateMany({
    where: { sourceName: "Animate Lottery" },
    data: { domain: "https://www.animate-onlineshop.jp/contents/fair_event/" },
  });

  const sourceSeed = [
    { sourceName: "Pokemon Center Online", sourceType: "SCRAPE", domain: "https://www.pokemoncenter-online.com/?main_page=campaign_list", crawlFrequency: 3600 },
    { sourceName: "Premium Bandai", sourceType: "SCRAPE", domain: "https://p-bandai.jp/chusen/", crawlFrequency: 3600 },
    { sourceName: "GEO Online", sourceType: "SCRAPE", domain: "https://geo-online.co.jp/store_info/service/lottery/", crawlFrequency: 3600 },
    { sourceName: "Animate Lottery", sourceType: "SCRAPE", domain: "https://www.animate-onlineshop.jp/contents/fair_event/", crawlFrequency: 3600 },
    { sourceName: "TSUTAYA", sourceType: "SCRAPE", domain: "https://tsutaya.tsite.jp/news/game/", crawlFrequency: 7200 },
    { sourceName: "Yamada Denki", sourceType: "SCRAPE", domain: "https://www.yamada-denki.jp/contact/lottery_sale.html", crawlFrequency: 7200 },
    { sourceName: "Bic Camera", sourceType: "SCRAPE", domain: "https://www.biccamera.com/bc/c/sale/special/lottery/index.jsp", crawlFrequency: 7200 },
    { sourceName: "Yodobashi Camera", sourceType: "SCRAPE", domain: "https://www.yodobashi.com/", crawlFrequency: 7200 },
    { sourceName: "Joshin", sourceType: "SCRAPE", domain: "https://joshinweb.jp/game/pokemon_lot.html", crawlFrequency: 7200 },
    { sourceName: "7net Shopping", sourceType: "SCRAPE", domain: "https://7net.omni7.jp/general/sp/pokemon", crawlFrequency: 3600 },
    { sourceName: "Bandai Spirits", sourceType: "SCRAPE", domain: "https://sn.bpnavi.jp/", crawlFrequency: 3600 },
    { sourceName: "Tamashii Nations", sourceType: "SCRAPE", domain: "https://tamashiiweb.com/event/", crawlFrequency: 3600 },
    { sourceName: "PokeGuardian", sourceType: "SCRAPE", domain: "https://www.pokeguardian.com/", crawlFrequency: 3600 },
    { sourceName: "Pokemon Card Official (JP)", sourceType: "SCRAPE", domain: "https://www.pokemon-card.com/info/", crawlFrequency: 3600 },
    { sourceName: "Rakuten Books", sourceType: "SCRAPE", domain: "https://books.rakuten.co.jp/event/game/pokemon/lottery/", crawlFrequency: 3600 },
    { sourceName: "Manual Ingest", sourceType: "MANUAL", domain: "local://manual-ingest", crawlFrequency: 0 },
  ];

  for (const s of sourceSeed) {
    const exists = await prisma.source.findFirst({ where: { sourceName: s.sourceName } });
    if (!exists) await prisma.source.create({ data: s });
  }

  const storeSeed = [
    { storeName: "Pokemon Center", aliases: "ポケモンセンター, ポケセン", region: "JP-WIDE" },
    { storeName: "GEO", aliases: "ゲオ", region: "JP-WIDE" },
    { storeName: "TSUTAYA", aliases: "ツタヤ", region: "JP-WIDE" },
    { storeName: "AEON / Kids Republic", aliases: "イオン, キッズリパブリック", region: "JP-WIDE" },
    { storeName: "Yamada Denki", aliases: "ヤマダ電機", region: "JP-WIDE" },
    { storeName: "Joshin", aliases: "ジョーシン", region: "JP-WIDE" },
    { storeName: "BookOff", aliases: "ブックオフ", region: "JP-WIDE" },
    { storeName: "Rakuten Books", aliases: "楽天ブックス", region: "JP-WIDE" },
    { storeName: "Bic Camera", aliases: "ビックカメラ", region: "JP-WIDE" },
    { storeName: "Yodobashi Camera", aliases: "ヨドバシカメラ", region: "JP-WIDE" },
    { storeName: "Animate", aliases: "アニメイト", region: "JP-WIDE" },
    { storeName: "Village Vanguard", aliases: "ヴィレッジヴァンガード", region: "JP-WIDE" },
    { storeName: "Don Quijote", aliases: "ドン・キホーテ", region: "JP-WIDE" },
    { storeName: "Ito-Yokado", aliases: "イトーヨーカドー", region: "JP-WIDE" },
    { storeName: "7net Shopping", aliases: "セブンネット", region: "JP-WIDE" },
    { storeName: "Amazon JP", aliases: "アマゾン", region: "JP-WIDE" },
    { storeName: "Bandai / Premium Bandai", aliases: "バンダイ, プレバン", region: "JP-WIDE" },
    { storeName: "Tamashii Nations", aliases: "魂ネイションズ", region: "JP-WIDE" },
    { storeName: "Yellow Submarine", aliases: "イエローサブマリン", region: "JP-WIDE" },
    { storeName: "Fullcomp", aliases: "フルコンプ", region: "JP-WIDE" },
    { storeName: "Hareruya 2", aliases: "晴れる屋2", region: "JP-WIDE" },
    { storeName: "Edion", aliases: "エディオン", region: "JP-WIDE" },
    { storeName: "C-Labo", aliases: "カードラボ", region: "JP-WIDE" },
    { storeName: "Furuichi", aliases: "古本市場, ふるいち", region: "JP-WIDE" },
  ];

  for (const s of storeSeed) {
    const exists = await prisma.store.findFirst({ where: { storeName: s.storeName } });
    if (!exists) await prisma.store.create({ data: s });
  }

  const tcgCount = await prisma.tcgCategory.count();
  if (tcgCount === 0) {
    const tcgSeed = [
      {
        name: "Pokemon",
        sets: [
          "SV8a: Terastal Festival ex", "SV8: Supercharged Breaker", "SV7a: Paradise Dragona",
          "SV7: Stellar Miracle", "SV6a: Night Wanderer", "SV6: Mask of Change",
          "SV5a: Crimson Haze", "SV5: Cyber Judge / Wild Force", "SV4a: Shiny Treasure ex",
          "SV4: Ancient Roar / Future Flash", "SV3a: Raging Surf", "SV3: Ruler of the Black Flame",
          "SV2a: Pokemon Card 151", "SV2P/SV2D: Snow Hazard / Clay Burst", "SV1a: Triplet Beat",
          "SV1S/SV1V: Scarlet ex / Violet ex",
        ],
      },
      {
        name: "One Piece",
        sets: [
          "OP-09: The New Genesis", "OP-08: Two Legends", "OP-07: 500 Years into the Future",
          "EB-01: Memorial Collection", "OP-06: Wings of the Captain",
          "OP-05: Awakening of the New Era", "OP-04: Kingdoms of Intrigue",
          "OP-03: Pillars of Strength", "OP-02: Paramount War", "OP-01: Romance Dawn",
        ],
      },
      {
        name: "Digimon",
        sets: ["BT-19: Xros Evolution", "BT-18: Element Successor", "BT-17: Secret Crisis", "BT-16: Beginning Observer"],
      },
    ];

    for (const item of tcgSeed) {
      const cat = await prisma.tcgCategory.create({ data: { name: item.name } });
      for (const setName of item.sets) {
        await prisma.set.create({ data: { setName, tcgCategoryId: cat.id } });
      }
    }
  }
}
