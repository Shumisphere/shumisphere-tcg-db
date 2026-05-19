const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.lotteryEvent.findMany({
    take: 10,
    select: {
      id: true,
      category: true,
      status: true,
      applicationStart: true,
      applicationEnd: true,
      resultDate: true,
      purchaseStart: true,
      purchaseEnd: true,
    }
  });
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
