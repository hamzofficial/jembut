import type { Update, Message, Document } from "./telegramTypes";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function assertToken() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
}

async function telegramFetch<T>(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  assertToken();
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram ${method} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function telegramFetchFormData<T>(method: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  assertToken();
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    body: formData,
    signal: signal ?? AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram ${method} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getUpdates(offset: number, timeout = 2): Promise<Update[]> {
  try {
    const res = await telegramFetch<{ ok: boolean; result: Update[] }>(
      "getUpdates",
      {
        offset,
        timeout,
        allowed_updates: ["message"],
      },
      AbortSignal.timeout(6000)
    );
    return res.result ?? [];
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.name === "TimeoutError" || msg.includes("aborted") || msg.includes("timeout")) {
      console.log("[telegramBot] getUpdates timeout (no new updates).");
      return [];
    }
    throw err;
  }
}

export async function sendMessage(chatId: number | string, text: string, parseMode: "HTML" | "Markdown" | undefined = "HTML"): Promise<Message> {
  const res = await telegramFetch<{ ok: boolean; result: Message }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_notification: true,
  });
  return res.result;
}

export async function sendChatAction(chatId: number | string, action: "typing" | "upload_document" | "upload_photo" | "record_video" | "upload_video" | "record_voice" | "upload_voice" | "choose_sticker" | "find_location" | "record_video_note" | "upload_video_note"): Promise<boolean> {
  const res = await telegramFetch<{ ok: boolean; result: boolean }>("sendChatAction", {
    chat_id: chatId,
    action,
  });
  return res.result;
}

export async function sendDocument(
  chatId: number | string,
  fileName: string,
  fileContent: string | Uint8Array,
  caption?: string
): Promise<Message> {
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  if (caption) formData.append("caption", caption);
  formData.append("document", new Blob([fileContent], { type: "application/json" }), fileName);

  const res = await telegramFetchFormData<{ ok: boolean; result: Message }>("sendDocument", formData);
  return res.result;
}

export async function sendDocumentWithRetry(
  chatId: number | string,
  fileName: string,
  fileContent: string | Uint8Array,
  caption?: string,
  maxRetries = 3
): Promise<Message> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendDocument(chatId, fileName, fileContent, caption);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";
      if (msg.includes("429") || msg.includes("Too Many Requests")) {
        const retryAfterMatch = msg.match(/retry_after[=:]\s*(\d+)/i) || msg.match(/(\d+)\s*seconds?/i);
        const waitMs = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : 2000 * attempt;
        console.warn(`[sendDocument] 429, waiting ${waitMs}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("sendDocument failed after retries");
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  parseMode: "HTML" | "Markdown" | undefined = undefined
): Promise<Message | boolean> {
  try {
    const res = await telegramFetch<{ ok: boolean; result: Message | boolean }>("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
    });
    return res.result;
  } catch (err) {
    console.error(`[editMessageText] Failed to edit message ${messageId} in chat ${chatId}:`, err);
    return false;
  }
}