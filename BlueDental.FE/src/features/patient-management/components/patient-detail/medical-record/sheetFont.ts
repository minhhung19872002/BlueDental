/**
 * The typeface the sheets are set in (R-1262).
 *
 * The forms are Times New Roman, and every line on them was measured in it.
 * A machine without it — a phone, a tablet, Linux — drew the sheet in the
 * browser's own serif, which is wider: Tuổi, Nghề nghiệp, Dân tộc broke onto a
 * second line on mẫu 2. Tinos (googlefonts/tinos, SIL OFL 1.1) is drawn to Times
 * New Roman's widths, so it is carried with the app, under its own name, and
 * stands second in the list.
 *
 * Second, not first: where Times New Roman is installed it is still what the
 * sheet is drawn in, letter for letter as before, and nothing is downloaded —
 * a face behind it is fetched only for a letter nothing before it has. The
 * files are split by script, like Google Fonts serves them, so a Vietnamese
 * sheet fetches the latin and vietnamese parts only.
 *
 * The files report Times New Roman's x-height, not Tinos's own (FONTLOG.txt
 * beside them): font-size-adjust sizes letters by it, and with Tinos's taller
 * one the letters came out 2.6% smaller than on a machine with Times New Roman.
 */

/** The family the sheets name after Times New Roman. */
const CARRIED_FAMILY = "BD Times";

/** Times New Roman, then the carried face, then whatever the machine has. */
export const SHEET_FONT_FAMILY = `'Times New Roman','${CARRIED_FAMILY}',Times,serif`;

const FONT_DIR = `${import.meta.env.BASE_URL}fonts/tinos/`;

/* Later faces win where ranges overlap, so the most general part comes last. */
const SCRIPTS = [
  {
    name: "vietnamese",
    range:
      "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  },
  {
    name: "latin-ext",
    range:
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  },
  {
    name: "latin",
    range:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
] as const;

const STYLES = [
  { weight: "400", style: "normal" },
  { weight: "400", style: "italic" },
  { weight: "700", style: "normal" },
  { weight: "700", style: "italic" },
] as const;

interface CarriedFace {
  url: string;
  range: string;
  weight: string;
  style: string;
}

const FACES: readonly CarriedFace[] = SCRIPTS.flatMap((script) =>
  STYLES.map((variant) => ({
    url: `${FONT_DIR}tinos-${script.name}-${variant.weight}-${variant.style}.woff2`,
    range: script.range,
    weight: variant.weight,
    style: variant.style,
  })),
);

/**
 * The faces as CSS, for the sheet's own document and for the print copy.
 *
 * `block`: a sheet is measured once its letters are in, and a moment of blank
 * paper is better than lines laid out in a stand-in and then redrawn.
 */
export const SHEET_FONT_FACE_CSS = FACES.map(
  (face) =>
    `@font-face{font-family:'${CARRIED_FAMILY}';font-style:${face.style};font-weight:${face.weight};font-display:block;src:url('${face.url}') format('woff2');unicode-range:${face.range}}`,
).join("\n");

/** Longest a sheet waits for its letters before it is laid out anyway. */
const TYPE_WAIT_MS = 3000;

/**
 * Runs `lay` once the letters the sheet is drawn in have arrived — at once, as
 * before, where nothing had to be fetched.
 *
 * The sheet's lines are fitted by measuring them, and measuring a stand-in
 * that is then swapped for the real face fits them to the wrong widths.
 */
export function whenSheetTypeReady(doc: Document, lay: () => void): void {
  const fonts = doc.fonts as FontFaceSet | undefined;
  // Laying the sheet out is what asks for a face; until then nothing loads.
  doc.body?.getBoundingClientRect();
  if (!fonts || fonts.status === "loaded") {
    lay();
    return;
  }

  const waited = new Promise((settle) => window.setTimeout(settle, TYPE_WAIT_MS));
  void Promise.race([fonts.ready, waited]).then(lay, lay);
}

/** Resolves once the letters this document is printing in have arrived. */
export async function typeReady(doc: Document, within = TYPE_WAIT_MS): Promise<void> {
  const fonts = doc.fonts as FontFaceSet | undefined;
  doc.body?.getBoundingClientRect();
  if (!fonts || fonts.status === "loaded") return;
  await Promise.race([fonts.ready, new Promise((settle) => window.setTimeout(settle, within))]);
}

let registered = false;

/**
 * Makes the carried face known to the app's own document, for text measured
 * there on a canvas (lineFit) rather than in a sheet. Like in a sheet, it is
 * fetched only for a letter Times New Roman does not supply.
 */
export function registerSheetFont(): void {
  if (registered || typeof FontFace === "undefined" || !document.fonts) return;
  registered = true;
  for (const face of FACES) {
    document.fonts.add(
      new FontFace(CARRIED_FAMILY, `url('${face.url}') format('woff2')`, {
        style: face.style,
        weight: face.weight,
        unicodeRange: face.range,
        display: "block",
      }),
    );
  }
}
