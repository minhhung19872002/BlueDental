const DOCTOR_TITLE = /^\s*bs\.?\s+/i;

/**
 * The name without a typed-in "BS." — the queue screens put the title in
 * front themselves ("BS. {0}"), and some staff records already carry it,
 * which would read "BS. BS. Lê Thu Hà".
 */
export function bareDentistName(name: string): string {
  return name.replace(DOCTOR_TITLE, "");
}

/** "AN" for "BS. Nguyễn Văn An": first and last word, the title left out. */
export function dentistInitials(name: string): string {
  const words = bareDentistName(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("vi");
  return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase("vi");
}
