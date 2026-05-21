import { request } from "undici";
import { prisma } from "../config/database.js";
import { logger } from "./logger.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Envia uma push notification via Expo Push API pro usuário, se ele tiver
 * um pushToken salvo. Erros são logados mas não propagam (best-effort).
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (!user?.pushToken) return;

    const res = await request(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: user.pushToken,
        title,
        body,
        sound: "default",
        priority: "high",
        data: data ?? {},
      }),
    });

    if (res.statusCode >= 400) {
      const text = await res.body.text();
      logger.warn({ userId, status: res.statusCode, text }, "Expo push falhou");
    }
  } catch (err) {
    logger.error({ err, userId }, "Erro ao enviar push");
  }
}
