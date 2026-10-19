/**
 * Breaking a long text into the dotted lines of a printed form, so that what
 * runs past one line goes on to the next blank instead of wrapping inside the
 * first (clinic, 2026-10-19: Chẩn đoán on mẫu 5).
 */

/** A4 less the sheet's 12mm margins each side, at 96dpi, less a blank's own padding. */
export const FULL_LINE_WIDTH = Math.floor(((210 - 24) / 25.4) * 96) - 8;

/** Splits `text` at spaces into lines no wider than `width` in the sheet's type at `fontSize`. */
export function makeLineSplitter(fontSize: number, width: number): (text: string) => string[] {
  const context = document.createElement("canvas").getContext("2d");
  return (text) => {
    const words = text.split(/\s+/).filter(Boolean);
    if (!context) return words.length ? [words.join(" ")] : [];
    context.font = `${fontSize}px 'Times New Roman', Times, serif`;

    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
}
