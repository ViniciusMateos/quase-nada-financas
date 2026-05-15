import { Queue, QueueEvents } from "bullmq";
import { redis } from "./redis.js";

export const PLUGGY_SYNC_QUEUE = "pluggy-sync";

export const pluggySyncQueue = new Queue(PLUGGY_SYNC_QUEUE, { connection: redis });
export const pluggySyncEvents = new QueueEvents(PLUGGY_SYNC_QUEUE, { connection: redis });
