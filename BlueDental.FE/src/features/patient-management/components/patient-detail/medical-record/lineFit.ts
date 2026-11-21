import { registerSheetFont, SHEET_FONT_FAMILY } from "./sheetFont";

/**
 * Breaking a long text into the dotted lines of a printed form, so that what
 * runs past one line goes on to the next blank instead of wrapping inside the
 * first (clinic, 2026-10-19: Chẩn đoán on mẫu 5).
 */

/** Times New Roman's lower case: its OS/2 x-height, 916 of 2048 units (sheetFont, FONTLOG.txt). */
export const TIMES_LETTER_HEIGHT = 916 / 2048;

/**
 * The size letters set at `size` are drawn at, with font-size-adjust at
 * `letterHeight` (sheetCss, --nfc-letter-height 0.5 since R-1234). A canvas
 * knows no font-size-adjust, so what it measures has to be set at this size.
 */
export function drawnLetterSize(size: number, letterHeight = 0.5): number {
  return (size * letterHeight) / TIMES_LETTER_HEIGHT;
}

/** A4 less the sheet's 12mm margins each side, at 96dpi, less a blank's own padding. */
export const FULL_LINE_WIDTH = Math.floor(((210 - 24) / 25.4) * 96) - 8;

/** Splits `text` at spaces into lines no wider than `width` in the sheet's type at `fontSize`. */
export function makeLineSplitter(fontSize: number, width: number): (text: string) => string[] {
  registerSheetFont();
  const context = document.createElement("canvas").getContext("2d");
  return (text) => {
    const words = text.split(/\s+/).filter(Boolean);
    if (!context) return words.length ? [words.join(" ")] : [];
    context.font = `${fontSize}px ${SHEET_FONT_FAMILY}`;

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
