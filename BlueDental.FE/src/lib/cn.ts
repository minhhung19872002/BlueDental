/**
 * Joins class names, dropping anything falsy.
 *
 * Tailwind is gone from this project, so this is the plain join the remaining
 * conditional class names need — no merge strategy, no dependency.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
