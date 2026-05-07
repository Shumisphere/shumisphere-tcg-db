import { prisma } from "../src/lib/db.js";

const sets = [
  { setName: "MEGA Dream ex",                                 code: "M2a", releaseDate: new Date("2025-11-28") },
  { setName: "Nullifying Zero",                               code: "M3",  releaseDate: new Date("2026-01-23") },
  { setName: "Ninja Spinner",                                 code: "M4",  releaseDate: new Date("2026-03-13") },
  { setName: "Abyss Eye",                                     code: "M5",  releaseDate: new Date("2026-05-22") },
  { setName: "Start Deck 100 Battle Collection",              code: "MC",  releaseDate: new Date("2025-12-19") },
  { setName: "Start Deck 100 Battle Collection CoroCoro Version", code: "MP1", releaseDate: new Date("2025-12-19") },
];

async function main() {
  // Create or fetch the category
  let category = await prisma.tcgCategory.findFirst({ where: { name: "Mega Evolution Era" } });
  if (!category) {
    category = await prisma.tcgCategory.create({ data: { name: "Mega Evolution Era" } });
    console.log(`Created category: ${category.name} (${category.id})`);
  } else {
    console.log(`Category already exists: ${category.name} (${category.id})`);
  }

  for (const s of sets) {
    const existing = await prisma.set.findFirst({
      where: { tcgCategoryId: category!.id, setName: s.setName },
    });
    if (existing) {
      console.log(`  SKIP (exists): ${s.setName}`);
    } else {
      const created = await prisma.set.create({
        data: { setName: s.setName, tcgCategoryId: category!.id, releaseDate: s.releaseDate },
      });
      console.log(`  Created set: ${s.code} — ${created.setName} (${created.id})`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
