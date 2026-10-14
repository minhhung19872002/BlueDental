import { VIETNAM, dialCodeOf, keepsLeadingZero, matchDialCode } from "./countries";

/**
 * A phone as the forms accept it. Vietnamese numbers stay national with
 * their 0 (8–15 digits); a foreign one is E.164, "+" country code and at most
 * 15 digits in all. "*" lets the masked form ("090****567", "+14*****123")
 * shown to an account with "Ẩn số điện thoại" (Cụm 11 mục 9) come back: the
 * server keeps the real number for a masked value it can match and refuses
 * one it cannot.
 */
export const PHONE_PATTERN = /^(\+[1-9][\d*]{6,14}|[\d*]{8,15})$/;

/** The most digits a number holds: the national box, and E.164 counting its country code. */
export const NATIONAL_MAX_LENGTH = 15;

export interface PhoneParts {
  iso: string;
  /** What the number box shows: the number without its country code. */
  national: string;
}

const MASK = "*";

/**
 * Splits a stored phone into country and national number. The pair always
 * composes back to the same string, so a value the user never touches —
 * a masked one above all — is sent back exactly as it came.
 */
export function parsePhone(value: string, preferred?: string): PhoneParts {
  if (!value.startsWith("+")) return { iso: VIETNAM, national: value };

  const match = matchDialCode(value.slice(1), preferred);
  if (!match) return { iso: VIETNAM, national: value };
  if (match.iso === VIETNAM) return { iso: VIETNAM, national: `0${value.slice(1 + match.dial.length)}` };
  return { iso: match.iso, national: value.slice(1 + match.dial.length) };
}

/**
 * The stored value for a country and what the box holds, and the box text
 * that goes with it. Abroad the trunk 0 is not dialled after the country
 * code, so it is dropped as it is typed ("0412…" under Australia → +61412…),
 * save where the 0 is part of the number (Italy…).
 */
export function composePhone(iso: string, national: string): { value: string; national: string } {
  if (iso === VIETNAM || national.startsWith("+")) return { value: national, national };

  const digits = national.includes(MASK) || keepsLeadingZero(iso) ? national : national.replace(/^0+/, "");
  return { value: digits ? `+${dialCodeOf(iso)}${digits}` : "", national: digits };
}

/**
 * What the user typed into the number box. A pasted or typed international
 * number ("+1 415…", "0044 20…") picks its own country; anything else keeps
 * only digits and the mask character.
 */
export function readTyped(text: string, iso: string): PhoneParts {
  const international = /^\s*(\+|00)/.exec(text);
  if (international) {
    const digits = keepDigits(text.slice(international[0].length));
    const parts = parsePhone(`+${digits}`, iso);
    return parts.national === `+${digits}` ? { iso, national: parts.national } : parts;
  }
  return { iso, national: keepDigits(text) };
}

function keepDigits(text: string): string {
  return text.replace(/[^\d*]/g, "").slice(0, NATIONAL_MAX_LENGTH);
}
