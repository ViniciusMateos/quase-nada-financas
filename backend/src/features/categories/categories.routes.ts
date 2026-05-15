import { FastifyInstance } from "fastify";
import { CategoriesService } from "./categories.service.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  const service = new CategoriesService();
  app.addHook("preHandler", authenticate);

  app.get("/", async (req, reply) => {
    const cats = await service.listForUser(req.userId);
    return reply.send({ categories: cats });
  });
}
