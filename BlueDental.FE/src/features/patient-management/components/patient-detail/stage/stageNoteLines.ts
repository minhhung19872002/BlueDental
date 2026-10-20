/** What starts every line of Nội dung điều trị (BA, 2026-10-19). */
export const NOTE_BULLET = "- ";

/**
 * A marker already typed at the start of a line: "-", "–", "—" or "•", with
 * whatever spaces follow. Stripped so a line never reads "- - …", and so a
 * placeholder made of dashes alone ("---", "—") counts as no content.
 */
const LEADING_MARKER = /^[-–—•]+\s*/;

/**
 * The lines of a Nội dung điều trị, without their bullets: trimmed, marker
 * dropped, blank lines left out. Notes written before the bullets came in
 * (plain lines) and after (bulleted ones) read the same.
 */
export function noteLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim().replace(LEADING_MARKER, "").trim())
    .filter(Boolean);
}

/** Lines written as a bulleted list, one "- " per line. */
export function bulletLines(lines: string[]): string {
  return lines.map((line) => `${NOTE_BULLET}${line}`).join("\n");
}

/** A note rewritten with every line bulleted — see {@link noteLines}. */
export function bulletNote(text: string): string {
  return bulletLines(noteLines(text));
}
