import IORedis, { Redis } from "ioredis";
import { env } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis: Redis =
  globalThis.__redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // requerido pelo BullMQ
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
