import {
  DEFAULT_SKETCH_SETTINGS,
  PAGE_PX_PER_POINT,
  SKETCH_LINE_HEIGHT,
  runStyleOf,
  type RunStyle,
  type TextAlign,
  type TextItem,
  type TextRun,
  type TextStyle,
} from "./sketch";

/**
 * Words of a text box laid out on the page as the box showed them while they
 * were typed: wrapped at the box's width the way the browser wraps
 * `white-space: pre-wrap; overflow-wrap: break-word` — whole words, a word
 * wider than the box broken between letters, spaces at a line's end hanging
 * past it — each stretch in its own font, and each line as tall as its
 * tallest letters.
 */

export function fontOf(style: RunStyle): string {
  const px = style.points * PAGE_PX_PER_POINT;
  return `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${px}px "${style.font}", sans-serif`;
}

let measurer: CanvasRenderingContext2D | null = null;
function measuring(): CanvasRenderingContext2D | null {
  measurer ??= document.createElement("canvas").getContext("2d");
  return measurer;
}

function widthOf(text: string, style: RunStyle): number {
  const ctx = measuring();
  if (!ctx) return text.length * style.points * PAGE_PX_PER_POINT * 0.5;
  ctx.font = fontOf(style);
  return ctx.measureText(text).width;
}

/** How far a line in this style reaches above and below its baseline, half-leading included. */
function extentOf(style: RunStyle): { above: number; below: number } {
  const px = style.points * PAGE_PX_PER_POINT;
  let ascent = px * 0.8;
  let descent = px * 0.2;
  const ctx = measuring();
  if (ctx) {
    ctx.font = fontOf(style);
    const box = ctx.measureText("Hg");
    if (box.fontBoundingBoxAscent) {
      ascent = box.fontBoundingBoxAscent;
      descent = box.fontBoundingBoxDescent;
    }
  }
  const lead = (px * SKETCH_LINE_HEIGHT - ascent - descent) / 2;
  return { above: ascent + lead, below: descent + lead };
}

interface Piece {
  text: string;
  run: TextRun;
  width: number;
}

/** A word, or the spaces between words — possibly over several runs, as "đậm" half bold. */
interface Token {
  pieces: Piece[];
  width: number;
  space: boolean;
}

interface Paragraph {
  tokens: Token[];
  /** The run its line break is in: an empty line is as tall as that. */
  end: TextRun;
}

function paragraphsOf(runs: readonly TextRun[]): Paragraph[] {
  const fallback = runs[runs.length - 1];
  const paragraphs: Paragraph[] = [{ tokens: [], end: fallback }];
  for (const run of runs) {
    run.text.split("\n").forEach((segment, at) => {
      if (at > 0) {
        paragraphs[paragraphs.length - 1].end = run;
        paragraphs.push({ tokens: [], end: fallback });
      }
      const { tokens } = paragraphs[paragraphs.length - 1];
      for (const [text] of segment.matchAll(/\s+|\S+/g)) {
        const space = /^\s/.test(text);
        const piece = { text, run, width: widthOf(text, run.style) };
        const last = tokens[tokens.length - 1];
        if (last && last.space === space) {
          last.pieces.push(piece);
          last.width += piece.width;
        } else {
          tokens.push({ pieces: [piece], width: piece.width, space });
        }
      }
    });
  }
  return paragraphs;
}

/** A word broken into its letters, for one too wide for the box. */
function lettersOf(token: Token): Token[] {
  return token.pieces.flatMap((piece) =>
    Array.from(piece.text, (letter) => {
      const width = widthOf(letter, piece.run.style);
      return { pieces: [{ text: letter, run: piece.run, width }], width, space: false };
    }),
  );
}

interface Row {
  pieces: Piece[];
  width: number;
  /** Up to the end of the last word: the spaces after it hang. */
  ink: number;
}

function wrap(paragraph: Paragraph, limit: number): Row[] {
  const rows: Row[] = [];
  let row: Row = { pieces: [], width: 0, ink: 0 };
  const add = (token: Token) => {
    row.pieces.push(...token.pieces);
    row.width += token.width;
    if (!token.space) row.ink = row.width;
  };
  const place = (token: Token) => {
    if (token.space || row.pieces.length === 0 || row.width + token.width <= limit) return add(token);
    rows.push(row);
    row = { pieces: [], width: 0, ink: 0 };
    add(token);
  };

  for (const token of paragraph.tokens) {
    const fits = token.space || row.width + token.width <= limit;
    if (fits || token.width <= limit) place(token);
    else {
      if (row.pieces.length > 0) {
        rows.push(row);
        row = { pieces: [], width: 0, ink: 0 };
      }
      lettersOf(token).forEach(place);
    }
  }
  rows.push(row);
  return rows;
}

export interface Fragment {
  text: string;
  run: TextRun;
  x: number;
  width: number;
}

export interface TextLine {
  baseline: number;
  /** Up to the end of the last word, from the line's start. */
  ink: number;
  fragments: Fragment[];
}

const SHIFT: Record<TextAlign, number> = { left: 0, center: 0.5, right: 1 };

/** Every line of a text box, placed on the page, and how tall the words make the box. */
export function layoutText(item: TextItem) {
  const lines: TextLine[] = [];
  let top = item.at.y;
  const blank: TextRun = { text: "", color: DEFAULT_SKETCH_SETTINGS.color, style: runStyleOf(DEFAULT_SKETCH_SETTINGS.text) };

  for (const paragraph of paragraphsOf(item.runs.length ? item.runs : [blank])) {
    for (const row of wrap(paragraph, item.width)) {
      const styles = row.pieces.length ? row.pieces.map((piece) => piece.run.style) : [paragraph.end.style];
      const extents = styles.map(extentOf);
      const above = Math.max(...extents.map((extent) => extent.above));
      const below = Math.max(...extents.map((extent) => extent.below));

      let x = item.at.x + Math.max(0, item.width - row.ink) * SHIFT[item.align];
      const fragments = row.pieces.map((piece) => {
        const fragment = { text: piece.text, run: piece.run, x, width: piece.width };
        x += piece.width;
        return fragment;
      });
      lines.push({ baseline: top + above, ink: row.ink, fragments });
      top += above + below;
    }
  }
  return { lines, height: top - item.at.y };
}


export function paintText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.textBaseline = "alphabetic";
  for (const line of layoutText(item).lines) {
    const inkEnd = (line.fragments[0]?.x ?? 0) + line.ink;
    for (const { text, run, x, width } of line.fragments) {
      ctx.font = fontOf(run.style);
      ctx.fillStyle = run.color;
      if (text.trim()) ctx.fillText(text, x, line.baseline);

      // Spaces between words are underlined too; those hanging at the end are not.
      const reach = Math.min(x + width, inkEnd) - x;
      if (reach <= 0) continue;
      const px = run.style.points * PAGE_PX_PER_POINT;
      const rule = Math.max(1, px / 16);
      if (run.style.underline) ctx.fillRect(x, line.baseline + px * 0.1, reach, rule);
      if (run.style.strike) ctx.fillRect(x, line.baseline - px * 0.3, reach, rule);
    }
  }
}

/** The box as it stands on the page: as wide as set, at least as tall as set. */
export function textBoxOf(item: TextItem) {
  return { x: item.at.x, y: item.at.y, width: item.width, height: Math.max(item.height, layoutText(item).height) };
}

/**
 * A text item saved before boxes could be sized: one style, one colour, as
 * wide as its longest line. It opens as a box that fits its words.
 */
export function boxFromLegacy(legacy: {
  id: string;
  at: TextItem["at"];
  text: string;
  color: string;
  style: TextStyle;
}): TextItem {
  const runs = [{ text: legacy.text, color: legacy.color, style: runStyleOf(legacy.style) }];
  const longest = Math.max(...legacy.text.split("\n").map((line) => widthOf(line, legacy.style)));
  const item: TextItem = {
    id: legacy.id,
    kind: "text",
    at: legacy.at,
    width: Math.ceil(longest) + 2,
    height: 0,
    align: legacy.style.align,
    runs,
  };
  return { ...item, height: layoutText(item).height };
}
