import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const onePieceSets = [
  { setName: "BOOSTER PACK -Legacy of the Master- [OP-12]",              releaseDate: null },
  { setName: "PREMIUM BOOSTER -ONE PIECE CARD THE BEST vol.2- [PRB-02]", releaseDate: new Date("2025-07-26") },
  { setName: "BOOSTER PACK -Carrying on His Will- [OP-13]",               releaseDate: new Date("2025-08-23") },
  { setName: "EXTRA BOOSTER -ONE PIECE Heroines Edition- [EB-03]",        releaseDate: new Date("2025-10-25") },
  { setName: "BOOSTER PACK -The Azure Sea's Seven- [OP-14]",              releaseDate: new Date("2025-11-22") },
  { setName: "EXTRA BOOSTER -EGGHEAD CRISIS- [EB-04]",                    releaseDate: new Date("2026-01-31") },
  { setName: "BOOSTER PACK -Adventure on KAMI's Island- [OP-15]",         releaseDate: new Date("2026-02-28") },
  { setName: "BOOSTER PACK -THE TIME OF BATTLE- [OP-16]",                 releaseDate: new Date("2026-05-30") },
];

const dragonBallSets = [
  { setName: "ブースターパック 烈火の闘気 [FB02]",        releaseDate: new Date("2024-05-10") },
  { setName: "ブースターパック 怒りの咆哮 [FB03]",        releaseDate: new Date("2024-08-09") },
  { setName: "ブースターパック 限界を超えし者 [FB04]",    releaseDate: new Date("2024-11-08") },
  { setName: "ブースターパック 未知なる冒険 [FB05]",      releaseDate: new Date("2025-02-08") },
  { setName: "ブースターパック 迫り来る脅威 [FB06]",      releaseDate: new Date("2025-04-26") },
  { setName: "MANGA BOOSTER 01 [SB01]",                  releaseDate: new Date("2025-06-28") },
  { setName: "ブースターパック 神龍への願い [FB07]",      releaseDate: new Date("2025-09-13") },
  { setName: "MANGA BOOSTER 02 [SB02]",                  releaseDate: new Date("2025-11-08") },
  { setName: "ブースターパック 誇り高き戦闘民族 [FB08]",  releaseDate: new Date("2025-12-13") },
  { setName: "ブースターパック DUAL EVOLUTION [FB09]",   releaseDate: new Date("2026-03-14") },
];

async function upsertSets(categoryName: string, sets: typeof onePieceSets) {
  const cat = await prisma.tcgCategory.findFirst({ where: { name: categoryName } });
  if (!cat) { console.error(`Category not found: ${categoryName}`); return; }
  console.log(`\n${cat.name} (${cat.id})`);

  for (const s of sets) {
    const exists = await prisma.set.findFirst({ where: { tcgCategoryId: cat.id, setName: s.setName } });
    if (exists) {
      console.log(`  SKIP: ${s.setName}`);
    } else {
      await prisma.set.create({ data: { setName: s.setName, tcgCategoryId: cat.id, releaseDate: s.releaseDate } });
      console.log(`  + ${s.setName} (${s.releaseDate?.toISOString().slice(0,10) ?? 'TBD'})`);
    }
  }
}

async function main() {
  await upsertSets("one--piece tcg", onePieceSets);
  await upsertSets("Dragon-Ball TCG", dragonBallSets);
  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
