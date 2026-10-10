import { NextResponse, type NextRequest } from "next/server";
import { isTelegramRateLimited, sendTelegramMessage } from "@/lib/server/telegram";

export const runtime = "nodejs";

const knownLabels = [
  "Normal",
  "Arrhythmia",
  "Cardiovascular Disease",
  "Coronary Artery Disease",
  "Congenital Heart Disease",
  "Cardiomyopathy",
  "Heart Infections",
];

function isLabelCount(value: unknown): value is { label: string; count: number } {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  return (
    Object.keys(fields).length === 2 &&
    typeof fields.label === "string" &&
    knownLabels.includes(fields.label) &&
    typeof fields.count === "number" &&
    Number.isSafeInteger(fields.count) &&
    fields.count > 0 &&
    fields.count <= 100_000
  );
}

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

  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ error: "Invalid notification request." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 400 });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Object.keys(payload).length !== 2 ||
    !("labels" in payload) ||
    !("kind" in payload) ||
    payload.kind !== "prediction-summary"
  ) {
    return NextResponse.json({ error: "The prediction notification request is invalid." }, { status: 400 });
  }

  const { labels } = payload;
  if (
    !Array.isArray(labels) ||
    labels.length < 1 ||
    labels.length > knownLabels.length ||
    !labels.every(isLabelCount) ||
    new Set(labels.map((item) => item.label)).size !== labels.length
  ) {
    return NextResponse.json({ error: "The prediction summary contains invalid labels or counts." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const summary = labels.map((item: { label: string; count: number }) =>
    item.count === 1 ? `Predicted: ${item.label}` : `${item.label}: ${item.count} prediction(s)`,
  );
  const message = [
    "AI research prediction report",
    `Timestamp (UTC): ${timestamp}`,
    ...summary,
    "Not a medical diagnosis.",
    "No user identity, credentials, confidence, or patient inputs were sent.",
  ].join("\n");

  const delivery = await sendTelegramMessage(message);
  if (!delivery.ok) {
    const errorMessages = {
      not_configured: "Telegram is not configured on the server. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, then restart the app.",
      invalid_token: "Telegram rejected the bot token. Check TELEGRAM_BOT_TOKEN and restart the app.",
      chat_unavailable: "Telegram cannot deliver to this chat. Start the bot with /start and verify TELEGRAM_CHAT_ID.",
      rate_limited: "Telegram is rate limiting messages. Wait briefly and try again.",
      rejected: "Telegram rejected the prediction report. Check that the bot and destination chat are available.",
      network_error: "The server could not reach Telegram. Check its network access and try again.",
    };
    const status = delivery.reason === "rate_limited" ? 429 : delivery.reason === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: errorMessages[delivery.reason] }, { status });
  }

  return NextResponse.json({ sent: true });
}
