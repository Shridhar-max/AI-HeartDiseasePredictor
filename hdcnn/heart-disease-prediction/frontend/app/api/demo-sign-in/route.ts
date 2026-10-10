import { NextResponse, type NextRequest } from "next/server";
import { isTelegramRateLimited, sendTelegramMessage } from "@/lib/server/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let originMatches = false;
  try {
    originMatches = origin !== null && new URL(origin).origin === new URL(request.url).origin;
  } catch {
    originMatches = false;
  }
  if (!originMatches) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403 });
  }

  if (isTelegramRateLimited(request)) {
    return NextResponse.json(
      { error: "Too many notification requests. Please try again later." },
      { status: 429 },
    );
  }

  if (Number(request.headers.get("content-length") ?? 0) > 1024) {
    return NextResponse.json({ error: "Invalid notification request." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "The access notification details are invalid." }, { status: 400 });
  }

  const fields = payload as Record<string, unknown>;
  if (
    fields.kind !== "demo-sign-in" ||
    Object.keys(fields).length !== 3 ||
    !Object.keys(fields).every((key) => ["kind", "fullName", "email"].includes(key)) ||
    typeof fields.fullName !== "string" ||
    typeof fields.email !== "string"
  ) {
    return NextResponse.json({ error: "The access notification details are invalid." }, { status: 400 });
  }

  const fullName = fields.fullName.trim().replace(/\s+/g, " ");
  const email = fields.email.trim().toLowerCase();
  if (
    fullName.length < 1 ||
    fullName.length > 120 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "The access notification details are invalid." }, { status: 400 });
  }

  const accessTime = new Date();
  const indianTimestamp = new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  }).format(accessTime);
  const exactIndianTimestamp = new Date(accessTime.getTime() + 330 * 60 * 1000)
    .toISOString()
    .replace("Z", "+05:30");
  const message = [
    "CardioLens demo sign-in",
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Access time (IST, UTC+05:30): ${indianTimestamp}`,
    `Exact timestamp: ${exactIndianTimestamp}`,
    "Demo sign-in; submitted credentials are not verified.",
  ].join("\n");

  const delivery = await sendTelegramMessage(message);
  if (!delivery.ok) {
    const errorMessages = {
      not_configured: "Telegram is not configured on the server. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, then restart the app.",
      invalid_token: "Telegram rejected the bot token. Check TELEGRAM_BOT_TOKEN and restart the app.",
      chat_unavailable: "Telegram cannot deliver to this chat. Start the bot with /start and verify TELEGRAM_CHAT_ID.",
      rate_limited: "Telegram is rate limiting messages. Wait briefly and try signing in again.",
      rejected: "Telegram rejected the sign-in message. Check that the bot and destination chat are available.",
      network_error: "The server could not reach Telegram. Check its network access and try again.",
    };
    const status = delivery.reason === "rate_limited" ? 429 : delivery.reason === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: errorMessages[delivery.reason] }, { status });
  }

  return NextResponse.json({ sent: true, messageId: delivery.messageId });
}
