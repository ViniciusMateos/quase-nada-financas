import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../src/features/categories/categories.seed.js";

const prisma = new PrismaClient();

async function main() {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
      create: {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
