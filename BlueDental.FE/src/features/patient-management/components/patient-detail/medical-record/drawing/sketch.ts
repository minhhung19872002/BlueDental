/**
 * The drawing pad behind "Lược đồ phẫu thuật/thủ thuật": what a drawing is made
 * of, and the tools that make it.
 *
 * A drawing is a list of *items* — strokes, shapes and pieces of text — each of
 * which can be picked out again with the select tool, moved, recoloured,
 * thickened or deleted, and text typed over. Undo steps back through whole
 * versions of that list. A picture saved before the items were kept is the
 * backdrop they are drawn over; it cannot be picked apart.
 *
 * The eraser rubs out as Paint's does, only where it passes: what it takes
 * from an item is kept on the item as *cuts*, so the gap moves with it, and an
 * item rubbed out entirely is gone.
 *
 * Tools follow what the clinic pointed at: Windows' Snipping Tool for the
 * pens and shapes, Paint for the eraser, the text box and the shared colour.
 */

export interface Point {
  x: number;
  y: number;
}

export type SketchTool = "select" | "pen" | "highlighter" | "eraser" | "shape" | "text";
export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";
export type TextAlign = "left" | "center" | "right";

/** The tools that draw with a size. */
export type SizedTool = "pen" | "highlighter" | "eraser" | "shape";

/** How a stretch of words is set; each stretch of a text box has its own, as in Paint. */
export interface RunStyle {
  font: string;
  /** In points as printed: the cell is a third of the page, so 1pt is 4 page pixels. */
  points: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

/** What the text bar shows: the style at the caret, and the box's alignment. */
export interface TextStyle extends RunStyle {
  align: TextAlign;
}

/** A stretch of words in one style and colour; "\n" inside it ends a line. */
export interface TextRun {
  text: string;
  color: string;
  style: RunStyle;
}

export type Item = (
  | { id: string; kind: "stroke"; tool: "pen" | "highlighter"; color: string; size: number; points: Point[] }
  | { id: string; kind: "shape"; shape: ShapeKind; color: string; size: number; from: Point; to: Point }
  /**
   * A text box as in Paint: `at` is its top left, the words wrap at its width,
   * and it grows taller than `height` when they need the room.
   */
  | { id: string; kind: "text"; at: Point; width: number; height: number; align: TextAlign; runs: TextRun[] }
) & {
  /** What the eraser has rubbed out of it, in page pixels. */
  cuts?: Cut[];
};

/** One pass of the eraser: a round tip `size` across, dragged through `points`. */
export interface Cut {
  size: number;
  points: Point[];
}

export type TextItem = Extract<Item, { kind: "text" }>;

export interface Scene {
  items: Item[];
  /** Whether the picture the drawing was opened with still shows under the items. */
  backdrop: boolean;
  /** What the eraser has rubbed out of that picture. */
  backdropCuts?: Cut[];
}

/**
 * The page in canvas pixels: three times the cell it is printed into
 * (334 × 219 CSS px on A4, measured), so it stays sharp on paper.
 */
export const SKETCH_WIDTH = 1002;
export const SKETCH_HEIGHT = 657;
export const PAGE_PX_PER_POINT = 4;

/** Paint's twenty, in its own two rows. */
export const SKETCH_COLORS = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
  "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7",
] as const;

export const SKETCH_FONTS = ["Arial", "Calibri", "Segoe UI", "Tahoma", "Times New Roman", "Courier New"] as const;
export const SKETCH_POINT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72] as const;
export const SKETCH_LINE_HEIGHT = 1.25;
/** The box a click with the text tool opens, in page pixels; a drag sizes it instead. */
export const TEXT_BOX_WIDTH = 320;
/** No text box is made narrower or shorter than this, in page pixels. */
export const TEXT_BOX_MIN = 24;

export function runStyleOf({ font, points, bold, italic, underline, strike }: RunStyle): RunStyle {
  return { font, points, bold, italic, underline, strike };
}

export function sameRunStyle(a: RunStyle, b: RunStyle): boolean {
  return (
    a.font === b.font && a.points === b.points && a.bold === b.bold &&
    a.italic === b.italic && a.underline === b.underline && a.strike === b.strike
  );
}

export const SIZE_RANGE: Record<SizedTool, { min: number; max: number }> = {
  pen: { min: 1, max: 24 },
  highlighter: { min: 6, max: 48 },
  eraser: { min: 6, max: 80 },
  shape: { min: 1, max: 24 },
};

export interface SketchSettings {
  tool: SketchTool;
  shape: ShapeKind;
  /** What is drawn and written in — one colour, shared by every tool. */
  color: string;
  sizes: Record<SizedTool, number>;
  text: TextStyle;
}

export const DEFAULT_SKETCH_SETTINGS: SketchSettings = {
  tool: "pen",
  shape: "arrow",
  color: "#ed1c24",
  sizes: { pen: 4, highlighter: 20, eraser: 24, shape: 4 },
  text: {
    font: "Arial",
    points: 11,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: "left",
  },
};

let counter = 0;
export function newItemId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

/** The item a press of the pointer starts with a drawing tool, as the tool is set now. */
export function startItem(settings: SketchSettings, at: Point): Item | null {
  const { tool, color, sizes } = settings;
  if (tool === "pen" || tool === "highlighter") {
    return { id: newItemId(), kind: "stroke", tool, color, size: sizes[tool], points: [at] };
  }
  if (tool === "shape") {
    return { id: newItemId(), kind: "shape", shape: settings.shape, color, size: sizes.shape, from: at, to: at };
  }
  return null;
}

export function moveItem(item: Item, dx: number, dy: number): Item {
  const shift = (point: Point) => ({ x: point.x + dx, y: point.y + dy });
  // The rubbed-out gaps go along with it.
  const cuts = item.cuts?.map((cut) => ({ ...cut, points: cut.points.map(shift) }));
  if (item.kind === "stroke") return { ...item, cuts, points: item.points.map(shift) };
  if (item.kind === "shape") return { ...item, cuts, from: shift(item.from), to: shift(item.to) };
  return { ...item, cuts, at: shift(item.at) };
}

export function replaceItem(items: readonly Item[], next: Item): Item[] {
  return items.map((item) => (item.id === next.id ? next : item));
}
