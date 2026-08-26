/** Uppercase alphabet without the look-alikes I, O, 0 and 1 — mirrors VoucherConsts. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Bare code without prefix — the server joins its prefix in on save. */
export function generateRandomCode(): string {
  return Array.from({ length: 8 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");
}

/** The ref allows uppercase letters, digits and dashes only. */
export function sanitizeVoucherCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
