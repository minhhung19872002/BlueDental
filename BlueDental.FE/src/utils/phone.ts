/** "0909 000 222" — a 10-digit phone grouped 4-3-3; anything else as typed. */
export function formatPhoneGroups(value: string): string {
  const digits = value.replace(/\s+/g, "");
  return /^\d{10}$/.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : value;
}

/**
 * The clinic's line(s) as a letterhead prints them: "0779 160 888 - 0767 080 333",
 * or just the one that is set; null when neither is (R-1335).
 */
export function joinPhones(...phones: (string | null | undefined)[]): string | null {
  const shown = phones.map((phone) => phone?.trim() ?? "").filter(Boolean).map(formatPhoneGroups);
  return shown.length > 0 ? shown.join(" - ") : null;
}
