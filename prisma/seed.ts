import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear everything first (just in case)
  await prisma.lotteryEvent.deleteMany({});
  await prisma.set.deleteMany({});
  await prisma.tcgCategory.deleteMany({});
  await prisma.source.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.product.deleteMany({});

  console.log("Seeding base categories...");
  const pokemon = await prisma.tcgCategory.create({
    data: {
      name: "Pokemon TCG",
      sets: {
        create: [
          { setName: "SV8a Terastal Festival" },
          { setName: "SV7 Blue Sky Stream" },
          { setName: "SV6 Mask of Change" }
        ]
      }
    }
  });

  const lorcana = await prisma.tcgCategory.create({
    data: {
      name: "Disney Lorcana",
      sets: {
        create: [
          { setName: "The First Chapter" },
          { setName: "Rise of the Floodborn" },
          { setName: "Into the Inklands" }
        ]
      }
    }
  });

  const yugioh = await prisma.tcgCategory.create({
    data: {
      name: "Yu-Gi-Oh!",
      sets: {
        create: [
          { setName: "Infinite Forbidden" },
          { setName: "Rage of the Abyss" }
        ]
      }
    }
  });

  console.log("Seeding base sources...");
  await prisma.source.createMany({
    data: [
      {
        sourceName: "Pokemon Center Japan",
        sourceType: "SCRAPE",
        domain: "https://www.pokemoncenter-online.com/",
        active: true
      },
      {
        sourceName: "Bonbon Sticker Store",
        sourceType: "SCRAPE",
        domain: "https://bonbon.co.jp/",
        active: true
      },
      {
        sourceName: "Family Mart Lottery",
        sourceType: "RSS",
        domain: "https://www.family.co.jp/services/lottery.html",
        active: true
      },
      {
        sourceName: "Pokemon Center Online",
        sourceType: "SCRAPE",
        domain: "https://www.pokemoncenter-online.com/?main_page=campaign_list",
        active: true
      },
      {
        sourceName: "Premium Bandai",
        sourceType: "SCRAPE",
        domain: "https://p-bandai.jp/chusen/",
        active: true
      },
      {
        sourceName: "GEO Online",
        sourceType: "SCRAPE",
        domain: "https://geo-online.co.jp/store_info/service/",
        active: true
      },
      {
        sourceName: "Animate Lottery",
        sourceType: "SCRAPE",
        domain: "https://www.animate-onlineshop.jp/contents/fair_event/",
        active: true
      },
      {
        sourceName: "TSUTAYA",
        sourceType: "SCRAPE",
        domain: "https://tsutaya.tsite.jp/",
        active: true
      },
      {
        sourceName: "Yamada Denki",
        sourceType: "SCRAPE",
        domain: "https://www.yamada-denki.jp/",
        active: true
      },
      {
        sourceName: "Bic Camera",
        sourceType: "SCRAPE",
        domain: "https://www.biccamera.com/bc/main/",
        active: true
      },
      {
        sourceName: "Yodobashi Camera",
        sourceType: "SCRAPE",
        domain: "https://www.yodobashi.com/",
        active: true
      },
      {
        sourceName: "Joshin",
        sourceType: "SCRAPE",
        domain: "https://joshinweb.jp/",
        active: true
      },
      {
        sourceName: "7net Shopping",
        sourceType: "SCRAPE",
        domain: "https://7net.omni7.jp/",
        active: true
      },
      {
        sourceName: "Bandai Spirits",
        sourceType: "SCRAPE",
        domain: "https://sn.bpnavi.jp/",
        active: true
      },
      {
        sourceName: "Tamashii Nations",
        sourceType: "SCRAPE",
        domain: "https://tamashiiweb.com/event/",
        active: true
      },
      {
        sourceName: "PokeGuardian",
        sourceType: "SCRAPE",
        domain: "https://www.pokeguardian.com/",
        active: true
      },
      {
        sourceName: "Pokemon Card Official (JP)",
        sourceType: "SCRAPE",
        domain: "https://www.pokemon-card.com/info/",
        active: true
      },
      {
        sourceName: "Rakuten Books",
        sourceType: "SCRAPE",
        domain: "https://books.rakuten.co.jp/",
        active: true
      }
    ]
  });

  console.log("Seeding base stores...");
  const pc = await prisma.store.create({
    data: { storeName: "Pokemon Center Online", region: "JP-WIDE" }
  });

  console.log("Seeding example event...");
  // Create a product for the event
  const pokeProduct = await prisma.product.create({
    data: {
      productName: "SV8a Terastal Festival Booster Box",
      franchise: "Pokemon",
      tcgCategoryId: pokemon.id
    }
  });

  // Get the source for the event
  const pcSource = await prisma.source.findFirst({ where: { sourceName: "Pokemon Center Japan" } });
  // Get the set for the event
  const sv8aSet = await prisma.set.findFirst({ where: { setName: "SV8a Terastal Festival" } });

  if (pcSource && sv8aSet) {
    await prisma.lotteryEvent.create({
      data: {
        productId: pokeProduct.id,
        storeId: pc.id,
        sourceId: pcSource.id,
        setId: sv8aSet.id,
        category: "TCG_LOTTERY",
        status: "ACTIVE",
        applicationStart: new Date(),
        applicationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        resultDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        sourceUrl: "https://www.pokemoncenter-online.com/example-lottery",
        notes: "Restored system data after malformed database error."
      }
    });
  }

  console.log("Seed completed.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
