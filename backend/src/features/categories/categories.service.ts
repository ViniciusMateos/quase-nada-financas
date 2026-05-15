import { prisma } from "../../config/database.js";
import type { Category } from "@prisma/client";

export class CategoriesService {
  listForUser(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { OR: [{ isDefault: true }, { userId }] },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }
}
