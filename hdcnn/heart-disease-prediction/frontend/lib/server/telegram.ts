import type { NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const requestsByAddress = new Map<string, number[]>();

export type TelegramSendResult =
  | { ok: true; messageId: number }
  | { ok: false; reason: "not_configured" | "invalid_token" | "chat_unavailable" | "rate_limited" | "rejected" | "network_error" };

export function isTelegramRateLimited(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();

  for (const [key, timestamps] of requestsByAddress) {
    const recentRequests = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recentRequests.length === 0) {
      requestsByAddress.delete(key);
    } else {
      requestsByAddress.set(key, recentRequests);
    }
  }

  const timestamps = requestsByAddress.get(address) ?? [];
  if (timestamps.length >= RATE_LIMIT_MAX) return true;

  if (requestsByAddress.size >= 1000 && !requestsByAddress.has(address)) {
    const oldestAddress = requestsByAddress.keys().next().value;
    if (oldestAddress) requestsByAddress.delete(oldestAddress);
  }
  requestsByAddress.set(address, [...timestamps, now]);
  return false;
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return { ok: false, reason: "not_configured" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      return { ok: false, reason: "rejected" };
    }

    if (response.ok && typeof result === "object" && result !== null && "ok" in result && result.ok === true) {
      if (
        "result" in result &&
        typeof result.result === "object" &&
        result.result !== null &&
        "message_id" in result.result &&
        typeof result.result.message_id === "number" &&
        Number.isSafeInteger(result.result.message_id)
      ) {
        return { ok: true, messageId: result.result.message_id };
      }
      return { ok: false, reason: "rejected" };
    }

    if (response.status === 401) return { ok: false, reason: "invalid_token" };
    if (response.status === 400 || response.status === 403) return { ok: false, reason: "chat_unavailable" };
    if (response.status === 429) return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
