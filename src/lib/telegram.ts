// src/lib/telegram.ts

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";
const WEBSITE_URL = "https://tradevault-sepia.vercel.app";

export async function sendTelegramSignal(signal: any) {
  try {
    // Determine direction label from signal
    const direction = (signal.direction || "long").toUpperCase();
    const isLong = direction === "LONG";
    const emoji = isLong ? "📈" : "📉";

    // Use the actual signal label if provided (BUY, SELL, BUY LIMIT, BUY STOP, etc.)
    const signalLabel = signal.signalLabel || direction;

    const pair = signal.pair || "UNKNOWN";

    // Zone info if available
    const zoneText = signal.zone
      ? `<b>📍 ${signal.zone.type?.toUpperCase() || "ZONE"}:</b> ${Number(signal.zone.bottom).toFixed(5)} - ${Number(signal.zone.top).toFixed(5)}`
      : "";

    // Confidence
    const confidence = signal.confidence || "NEUTRAL";
    const score = signal.score ?? signal.confidenceScore ?? 0;

    // Session
    const session =
      signal.session ||
      signal.confluenceBreakdown?.session ||
      "";

    // Order type description
    const orderTypeDesc =
      signal.orderTypeDescription ||
      (signal.orderType ? signal.orderType.replace(/_/g, " ") : "MARKET");

    // Format entry / SL / TP — handle string or number
    const formatPrice = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? String(v) : n.toFixed(5);
    };

    const entry = signal.entryPrice ?? signal.entry;
    const stopLoss = signal.stopLossPrice ?? signal.stopLoss;
    const tp1 = signal.takeProfit1Price ?? signal.takeProfit1;
    const tp2 = signal.takeProfit2Price ?? signal.takeProfit2;
    const tp3 = signal.takeProfit3Price ?? signal.takeProfit3;

    // Build message using HTML (safer than Markdown for special chars)
    const lines: string[] = [];

    lines.push(`${emoji} <b>TradeVault Signal</b>`);
    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`<b>Pair:</b> ${pair}`);
    lines.push(`<b>Signal:</b> ${signalLabel}`);
    lines.push(`<b>Order:</b> ${orderTypeDesc}`);

    if (zoneText) {
      lines.push(`━━━━━━━━━━━━━━━`);
      lines.push(zoneText);
    }

    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`<b>Entry:</b> ${formatPrice(entry)}`);
    lines.push(`<b>Stop Loss:</b> ${formatPrice(stopLoss)}`);
    lines.push(`<b>Take Profit 1:</b> ${formatPrice(tp1)}`);

    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`<b>Confidence:</b> ${confidence} (${score}/100)`);
    if (session) {
      lines.push(`<b>Session:</b> ${session}`);
    }

    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`🔒 <b>Want TP2 & TP3 with full analysis?</b>`);
    lines.push(`👉 Join TradeVault VIP: ${WEBSITE_URL}`);

    const message = lines.join("\n");

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHANNEL_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram send failed:", data.description);
      return false;
    }

    console.log("Signal posted to Telegram channel:", pair, signalLabel);
    return true;
  } catch (error) {
    console.error("Telegram error:", error);
    return false;
  }
}