import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";

/**
 * Creates a TelegramClient instance from a stored session string.
 */
export function createClientFromSession(sessionString: string): TelegramClient {
  const apiId = parseInt(process.env.API_ID || "");
  const apiHash = process.env.API_HASH || "";

  if (!apiId || !apiHash) {
    throw new Error("Missing API_ID or API_HASH in environment variables.");
  }

  const stringSession = new StringSession(sessionString);
  return new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 2,
    retryDelay: 1000,
    timeout: 10,
    baseLogger: new Logger(LogLevel.NONE),
  });
}

export type SessionHealth = {
  active: boolean;
  user?: any;
  error?: string;
};

/**
 * Verifies if a session is still active.
 */
export async function verifySessionHealth(sessionString: string): Promise<SessionHealth> {
  let client: TelegramClient | null = null;
  try {
    client = createClientFromSession(sessionString);
    await client.connect();
    
    const isAuth = await client.checkAuthorization();
    if (!isAuth) {
      return { active: false, error: "Not authorized (session revoked or expired)." };
    }

    const me = await client.getMe();
    return { active: true, user: me };
  } catch (err: any) {
    console.error("[telegramClient] verifySessionHealth error:", err?.message || err);
    return { active: false, error: err?.message || String(err) };
  } finally {
    if (client) {
      try { await client.disconnect(); } catch {}
    }
  }
}

export type FetchOtpResult = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Fetches latest OTP message from Telegram official notifications (777000).
 */
export async function fetchOtpFromTelegramSession(sessionString: string): Promise<FetchOtpResult> {
  let client: TelegramClient | null = null;
  try {
    const apiId = parseInt(process.env.API_ID || "");
    const apiHash = process.env.API_HASH || "";

    if (!apiId || !apiHash) {
      return { success: false, error: "Missing API_ID or API_HASH in environment variables." };
    }

    const stringSession = new StringSession(sessionString);
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 2,
      retryDelay: 1000,
      timeout: 10,
      baseLogger: new Logger(LogLevel.NONE),
    });

    await client.connect();

    const isAuth = await client.checkAuthorization();
    if (!isAuth) {
      return { success: false, error: "Sesi tidak valid atau sudah expired." };
    }

    // Ambil pesan dari Telegram official (777000) dan Saved Messages (0 = self)
    const messages = await client.getMessages(777000, { limit: 3 });
    
    if (messages && messages.length > 0) {
      // Ambil pesan pertama yang ada text
      const latestMsg = messages.find(m => m.message);
      if (latestMsg?.message) {
        return { success: true, message: latestMsg.message };
      }
    }

    return { success: true, message: undefined };
  } catch (err: any) {
    console.error("[telegramClient] fetchOtpFromTelegramSession error:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  } finally {
    if (client) {
      try { await client.disconnect(); } catch {}
    }
  }
}
