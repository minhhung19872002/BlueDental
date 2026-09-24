import type { Gender } from "../types/patient";

/** What the QR on the front of a CCCD / Căn cước carries. */
export interface CccdCard {
  /** Số CCCD — 12 digits. */
  nationalId: string;
  /** Số CMND cũ, when the card prints one. */
  formerId: string | null;
  fullName: string | null;
  /** "YYYY-MM-DD". */
  dateOfBirth: string | null;
  gender: Gender | null;
  /** Nơi thường trú, exactly as printed. */
  address: string | null;
  /** Ngày cấp, "YYYY-MM-DD". */
  issuedOn: string | null;
}

const NATIONAL_ID = /^\d{12}$/;

/** "15031990" → "1990-03-15"; anything that is not a real date → null. */
function parseCardDate(value: string | undefined): string | null {
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(value?.trim() ?? "");
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const real =
    date.getUTCFullYear() === Number(yyyy) &&
    date.getUTCMonth() === Number(mm) - 1 &&
    date.getUTCDate() === Number(dd);

  return real ? `${yyyy}-${mm}-${dd}` : null;
}

function parseGender(value: string | undefined): Gender | null {
  const text = value?.trim().toLocaleLowerCase("vi");
  if (text === "nam" || text === "male") return "male";
  if (text === "nữ" || text === "nu" || text === "female") return "female";
  return null;
}

function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Reads the text behind a CCCD's QR code:
 * `CCCD|CMND|Họ tên|ddMMyyyy sinh|Giới tính|Địa chỉ|ddMMyyyy cấp`.
 * Anything else — another QR, a bare number — is not a card: null.
 */
export function parseCccdQr(raw: string): CccdCard | null {
  const text = raw.trim();
  const parts = text.split("|");
  const nationalId = parts[0]?.trim() ?? "";
  if (parts.length < 6 || !NATIONAL_ID.test(nationalId)) return null;

  return {
    nationalId,
    formerId: orNull(parts[1]),
    fullName: orNull(parts[2]),
    dateOfBirth: parseCardDate(parts[3]),
    gender: parseGender(parts[4]),
    address: orNull(parts[5]),
    issuedOn: parseCardDate(parts[6]),
  };
}
