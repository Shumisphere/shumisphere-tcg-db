/**
 * Seed Script: Pokemon Scarlet & Violet + MEGA Series Sets
 * Run with: node scripts/seed-sv-sets.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SV_SETS = [
    { setName: "スカーレットex • バイオレットex (Scarlet ex / Violet ex)", releaseDate: "2023-01-20" },
    { setName: "スノーハザード • クレイバースト (Snow Hazard / Clay Burst)", releaseDate: "2023-04-14" },
    { setName: "黒炎の支配者 (Ruler of the Black Flame)", releaseDate: "2023-07-28" },
    { setName: "古代の咆哮 • 未来の一閃 (Ancient Roar / Future Flash)", releaseDate: "2023-10-27" },
    { setName: "ワイルドフォース • サイバージャッジ (Wild Force / Cyber Judge)", releaseDate: "2024-01-26" },
    { setName: "変幻の仮面 (Transformation Mask)", releaseDate: "2024-04-26" },
    { setName: "ステラミラクル (Stellar Miracle)", releaseDate: "2024-07-19" },
    { setName: "超電ブレイカー (Super Electric Breaker)", releaseDate: "2024-10-18" },
    { setName: "バトルパートナーズ (Battle Partners)", releaseDate: "2025-01-24" },
    { setName: "ロケット団の栄光 (Glory of the Rocket Gang)", releaseDate: "2025-04-18" },
    { setName: "ブラックボルト • ホワイトフレア (Black Bolt / White Flare)", releaseDate: "2025-06-06" },
];

const MEGA_SETS = [
    { setName: "メガブレイブ • メガシンフォニア (Mega Brave / Mega Symphonia)", releaseDate: "2025-08-01" },
    { setName: "インフェルノX (Inferno X)", releaseDate: "2025-09-26" },
    { setName: "ムニキスゼロ (Nihil Zero)", releaseDate: "2026-01-23" },
    { setName: "ニンジャスピナー (Ninja Spinner)", releaseDate: "2026-03-13" },
    { setName: "アビスアイ (Abyss Eye)", releaseDate: "2026-05-22" },
];

async function main() {
    console.log("🔍 Looking up Pokemon TCG category...");

    let category = await prisma.tcgCategory.findFirst({
        where: { name: { contains: "Pokemon", mode: "insensitive" } },
    });

    if (!category) {
        category = await prisma.tcgCategory.findFirst({
            where: { name: { contains: "ポケモン", mode: "insensitive" } },
        });
    }

    if (!category) {
        console.log("⚠️  No Pokemon category found — creating one...");
        category = await prisma.tcgCategory.create({
            data: { name: "Pokemon" },
        });
        console.log(`✅ Created category: ${category.name} (${category.id})`);
    } else {
        console.log(`✅ Found category: ${category.name} (${category.id})`);
    }

    const categoryId = category.id;

    const existing = await prisma.set.findMany({
        where: { tcgCategoryId: categoryId },
        select: { setName: true },
    });
    const existingNames = new Set(existing.map((s) => s.setName));
    console.log(`📦 Found ${existing.length} existing sets in this category.\n`);

    let created = 0;
    let skipped = 0;

    const allSets = [
        ...SV_SETS.map((s) => ({ ...s, era: "Scarlet & Violet" })),
        ...MEGA_SETS.map((s) => ({ ...s, era: "MEGA Series" })),
    ];

    for (const s of allSets) {
        if (existingNames.has(s.setName)) {
            console.log(`  ⏭️  Skipping (exists): ${s.setName}`);
            skipped++;
            continue;
        }
        await prisma.set.create({
            data: {
                setName: s.setName,
                releaseDate: new Date(s.releaseDate),
                tcgCategoryId: categoryId,
            },
        });
        console.log(`  ✅ [${s.era}] Added: ${s.setName}`);
        created++;
    }

    console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
