/**
 * The size each form was drawn for, before every form's writing went to 17px
 * (owner, 2026-11-21, sheetCss): its blanks' widths and its lines were laid out
 * at that size. Mẫu 2's blanks were drawn for 13px (R-1067), though it was set
 * at 14px. The cover (mẫu 1) was already 17px; mẫu 11 stays at its 13px;
 * mẫu 10 is set as the clinic's own copy (20px, sheetCss).
 *
 * fitBlanks and holdLines measure a line here — at the drawn size, the letters
 * not enlarged — to know whether it held on one line as drawn, and keep it so.
 */
const DRAWN_FONT_SIZES: Readonly<Record<string, number>> = {
  "2": 13,
  "3": 15,
  "4": 16,
  "5": 16,
  "6": 15,
  "7": 14,
  "8": 14,
  "9": 15.5,
  "12": 14,
};

/** The drawn size of this sheet's form, in px, or null when it is set at it. */
export function drawnFontSize(sheet: HTMLElement): number | null {
  return DRAWN_FONT_SIZES[sheet.dataset.form ?? ""] ?? null;
}

/** Runs `measure` with the sheet at its drawn size and its letters as drawn, then puts it back. */
export function atDrawnSize<T>(sheet: HTMLElement, measure: () => T): T {
  const before = { fontSize: sheet.style.fontSize, fontSizeAdjust: sheet.style.fontSizeAdjust };
  const drawn = drawnFontSize(sheet);
  if (drawn !== null) sheet.style.fontSize = `${drawn}px`;
  sheet.style.fontSizeAdjust = "none";
  try {
    return measure();
  } finally {
    sheet.style.fontSize = before.fontSize;
    sheet.style.fontSizeAdjust = before.fontSizeAdjust;
  }
}
