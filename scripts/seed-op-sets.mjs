/**
 * Seed Script: One Piece Card Game Sets
 * Includes: Booster Packs (OP), Starter Decks (ST), Extra Boosters (EB), Card the Best (PRB)
 * Run with: node scripts/seed-op-sets.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Booster Packs (OP-01 to OP-16)
const BOOSTER_PACKS = [
    { setName: "ROMANCE DAWN 【OP-01】",               releaseDate: "2022-12-02" },
    { setName: "SUMMIT WAR 頂上決戦 【OP-02】",         releaseDate: "2023-03-04" },
    { setName: "POWERFUL ENEMIES 強大な敵 【OP-03】",   releaseDate: "2023-06-02" },
    { setName: "KINGDOMS OF INTRIGUE 謀略の王国 【OP-04】", releaseDate: "2023-09-22" },
    { setName: "STAR OF THE NEW ERA 新時代の主役 【OP-05】", releaseDate: "2023-12-01" },
    { setName: "TWIN CHAMPIONS 双璧の覇者 【OP-06】",   releaseDate: "2024-03-08" },
    { setName: "500 YEARS IN THE FUTURE 500年後の未来 【OP-07】", releaseDate: "2024-06-28" },
    { setName: "TWO LEGENDS 二つの伝説 【OP-08】",      releaseDate: "2024-09-27" },
    { setName: "THE NEW EMPERORS 新たなる皇帝 【OP-09】", releaseDate: "2024-12-06" },
    { setName: "ROYAL BLOOD 王族の血統 【OP-10】",      releaseDate: "2025-03-07" },
    { setName: "A FIST OF DIVINE SPEED 神速の拳 【OP-11】", releaseDate: "2025-06-06" },
    { setName: "TEACHER-STUDENT BOND 師弟の絆 【OP-12】", releaseDate: "2025-09-26" },
    { setName: "INHERITED WILL け継がれる意志 【OP-13】", releaseDate: "2025-12-05" },
    { setName: "SEVEN HEROES OF THE SEAS 蒼海の七傑 【OP-14】", releaseDate: "2026-03-13" },
    { setName: "ADVENTURE ON GOD'S ISLAND 神の島の冒険 【OP-15】", releaseDate: "2026-05-22" },
    { setName: "THE TIME OF BATTLE 決戦の刻 【OP-16】", releaseDate: "2026-08-01" },
];

// Starter Decks (ST-01 to ST-30)
const STARTER_DECKS = [
    { setName: "Starter Deck Straw Hat Pirates 麦わらの一味 【ST-01】",          releaseDate: "2022-12-02" },
    { setName: "Starter Deck Worst Generation 最悪の世代 【ST-02】",             releaseDate: "2022-12-02" },
    { setName: "Starter Deck The Seven Warlords 王下七武海 【ST-03】",           releaseDate: "2022-12-02" },
    { setName: "Starter Deck Beasts Pirates 百獣海賊団 【ST-04】",               releaseDate: "2022-12-02" },
    { setName: "Starter Deck One Piece Film Edition 【ST-05】",                  releaseDate: "2023-08-26" },
    { setName: "Starter Deck Absolute Justice 海軍 【ST-06】",                   releaseDate: "2023-06-02" },
    { setName: "Starter Deck Big Mom Pirates ビッグ・マム海賊団 【ST-07】",      releaseDate: "2023-03-04" },
    { setName: "Starter Deck Side Monkey D. Luffy 【ST-08】",                    releaseDate: "2023-12-01" },
    { setName: "Starter Deck Side Yamato 【ST-09】",                             releaseDate: "2023-12-01" },
    { setName: "Ultimate Deck Rising Three Captains 三船長集結 【ST-10】",       releaseDate: "2024-03-08" },
    { setName: "Starter Deck Side Uta 【ST-11】",                                releaseDate: "2023-08-26" },
    { setName: "Starter Deck Zoro & Sanji ゾロ&サンジ 【ST-12】",               releaseDate: "2024-06-28" },
    { setName: "Ultimate Deck 3 Brothers' Bond 3兄弟の絆 【ST-13】",             releaseDate: "2024-03-08" },
    { setName: "Starter Deck 3D2Y 【ST-14】",                                    releaseDate: "2024-09-27" },
    { setName: "Starter Deck Red Edward Newgate 赤エドワード・ニューゲート 【ST-15】", releaseDate: "2024-12-06" },
    { setName: "Starter Deck Green Uta 緑ウタ 【ST-16】",                        releaseDate: "2024-12-06" },
    { setName: "Starter Deck Blue Donquixote Doflamingo 青ドフラミンゴ 【ST-17】", releaseDate: "2024-12-06" },
    { setName: "Starter Deck Purple Monkey D. Luffy 紫ルフィ 【ST-18】",         releaseDate: "2024-12-06" },
    { setName: "Starter Deck Black Smoker 黒スモーカー 【ST-19】",               releaseDate: "2024-12-06" },
    { setName: "Starter Deck Yellow Charlotte Katakuri 黄カタクリ 【ST-20】",    releaseDate: "2024-12-06" },
    { setName: "Starter Deck EX Gear 5 ギア5 【ST-21】",                        releaseDate: "2025-06-06" },
    { setName: "Starter Deck Ace & Newgate エース&ニューゲート 【ST-22】",       releaseDate: "2025-09-26" },
    { setName: "Starter Deck Red Shanks 赤シャンクス 【ST-23】",                 releaseDate: "2025-12-05" },
    { setName: "Starter Deck Green Jewelry Bonney 緑ボニー 【ST-24】",           releaseDate: "2025-12-05" },
    { setName: "Starter Deck Blue Buggy 青バギー 【ST-25】",                     releaseDate: "2025-12-05" },
    { setName: "Starter Deck Purple/Black Monkey D. Luffy 紫黒ルフィ 【ST-26】", releaseDate: "2025-12-05" },
    { setName: "Starter Deck Black Marshall D. Teach 黒ティーチ 【ST-27】",      releaseDate: "2025-12-05" },
    { setName: "Starter Deck Green/Yellow Yamato 緑黄ヤマト 【ST-28】",          releaseDate: "2025-12-05" },
    { setName: "Starter Deck Egghead EGGHEAD 【ST-29】",                         releaseDate: "2026-03-13" },
    { setName: "Starter Deck EX Luffy & Ace ルフィ&エース 【ST-30】",           releaseDate: "2026-05-22" },
];

// Extra Boosters (EB) & Card the Best (PRB)
const EXTRA_SETS = [
    { setName: "Extra Booster Memorial Collection 【EB-01】",     releaseDate: "2024-01-27" },
    { setName: "Extra Booster Anime 25th Collection 【EB-02】",   releaseDate: "2024-09-27" },
    { setName: "Extra Booster One Piece Heroines Edition 【EB-03】", releaseDate: "2025-05-02" },
    { setName: "Extra Booster Egghead Crisis 【EB-04】",          releaseDate: "2025-09-26" },
    { setName: "One Piece Card the Best Vol.1 【PRB-01】",        releaseDate: "2024-06-28" },
    { setName: "One Piece Card the Best Vol.2 【PRB-02】",        releaseDate: "2025-06-06" },
];

async function main() {
    console.log("🔍 Looking up One Piece TCG category...");

    let category = await prisma.tcgCategory.findFirst({
        where: { name: { contains: "One Piece", mode: "insensitive" } },
    });

    if (!category) {
        category = await prisma.tcgCategory.findFirst({
            where: { name: { contains: "ワンピース", mode: "insensitive" } },
        });
    }

    if (!category) {
        console.log("⚠️  No One Piece category found — creating one...");
        category = await prisma.tcgCategory.create({
            data: { name: "One Piece" },
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

    const groups = [
        { label: "Booster Pack", sets: BOOSTER_PACKS },
        { label: "Starter Deck", sets: STARTER_DECKS },
        { label: "Extra / Best",  sets: EXTRA_SETS },
    ];

    for (const { label, sets } of groups) {
        console.log(`\n--- ${label}s ---`);
        for (const s of sets) {
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
            console.log(`  ✅ Added: ${s.setName}`);
            created++;
        }
    }

    console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
