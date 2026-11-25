import { sendMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let appUrl = process.env.APP_URL || "";

  if (!botToken) {
    return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  if (!appUrl) {
    return Response.json({ error: "APP_URL not set in environment variables" }, { status: 500 });
  }

  // Pastikan APP_URL punya https://
  if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    appUrl = "https://" + appUrl;
  }

  const webhookUrl = `${appUrl}/api/bot/webhook`;
  const secretToken = process.env.WEBHOOK_SECRET || "";

  try {
    const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const body: Record<string, string> = {
      url: webhookUrl,
      allowed_updates: JSON.stringify(["message", "callback_query"]),
    };
    if (secretToken) body.secret_token = secretToken;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      const desc = data.description ?? `HTTP ${res.status}`;
      console.error("[setup-webhook] Failed to set webhook:", desc);
      return Response.json({ ok: false, error: desc }, { status: 500 });
    }

    console.log("[setup-webhook] Webhook set successfully:", webhookUrl);
    return Response.json({ ok: true, url: webhookUrl, result: data.result });
  } catch (err) {
    console.error("[setup-webhook] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
