import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").trim();
  if (!cleaned) return null;

  let phoneNumber;
  if (cleaned.startsWith("+")) {
    phoneNumber = parsePhoneNumberFromString(cleaned);
  } else if (cleaned.startsWith("0")) {
    phoneNumber = parsePhoneNumberFromString(cleaned, "ID");
  } else {
    phoneNumber = parsePhoneNumberFromString("+" + cleaned);
  }

  if (!phoneNumber || !phoneNumber.isValid()) {
    phoneNumber = parsePhoneNumberFromString(cleaned, "ID");
    if (!phoneNumber || !phoneNumber.isValid()) {
      return null;
    }
  }

  return phoneNumber.format("E.164");
}

export function validatePhone(raw: string): { ok: boolean; normalized: string | null; error?: string } {
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return { ok: false, normalized: null, error: "Format nomor tidak valid. Contoh: +62812... atau +1415..." };
  }
  return { ok: true, normalized };
}

export function formatPhoneDisplay(phoneE164: string): string {
  const phoneNumber = parsePhoneNumberFromString(phoneE164);
  if (!phoneNumber) return phoneE164;
  return phoneNumber.format("INTERNATIONAL");
}

export function normalizeForTelegram(raw: string): { ok: boolean; telegramFormat: string; error?: string } {
  const cleaned = raw.replace(/\s+/g, "").trim();
  if (!cleaned) {
    return { ok: false, telegramFormat: "", error: "Nomor kosong" };
  }

  let phoneNumber;
  if (cleaned.startsWith("+")) {
    phoneNumber = parsePhoneNumberFromString(cleaned);
  } else if (cleaned.startsWith("0")) {
    phoneNumber = parsePhoneNumberFromString(cleaned, "ID");
  } else {
    phoneNumber = parsePhoneNumberFromString("+" + cleaned);
  }

  if (!phoneNumber || !phoneNumber.isValid()) {
    phoneNumber = parsePhoneNumberFromString(cleaned, "ID");
    if (!phoneNumber || !phoneNumber.isValid()) {
      return { ok: false, telegramFormat: "", error: "Format nomor tidak valid" };
    }
  }

  const e164 = phoneNumber.format("E.164");
  const telegramFormat = e164.startsWith("+") ? e164.slice(1) : e164;
  return { ok: true, telegramFormat };
}