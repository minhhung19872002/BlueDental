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
 * Tools follow what the clinic pointed at: Windows' Snipping Tool for the
 * pens, eraser and shapes, Paint for the text box and the shared colours.
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

export interface TextStyle {
  font: string;
  /** In points as printed: the cell is a third of the page, so 1pt is 4 page pixels. */
  points: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: TextAlign;
  /** Paint's "Background fill": the words sit on colour 2. */
  filled: boolean;
}

export type Item =
  | { id: string; kind: "stroke"; tool: "pen" | "highlighter"; color: string; size: number; points: Point[] }
  | { id: string; kind: "shape"; shape: ShapeKind; color: string; size: number; from: Point; to: Point }
  /** `at` is the top left of the first line; `fill` is set when the words sit on a colour. */
  | { id: string; kind: "text"; text: string; at: Point; color: string; fill: string | null; style: TextStyle };

export type TextItem = Extract<Item, { kind: "text" }>;

export interface Scene {
  items: Item[];
  /** Whether the picture the drawing was opened with still shows under the items. */
  backdrop: boolean;
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

export const SIZE_RANGE: Record<SizedTool, { min: number; max: number }> = {
  pen: { min: 1, max: 24 },
  highlighter: { min: 6, max: 48 },
  eraser: { min: 6, max: 80 },
  shape: { min: 1, max: 24 },
};

export interface SketchSettings {
  tool: SketchTool;
  shape: ShapeKind;
  /** Paint's colour 1: what is drawn and written in. Shared by every tool. */
  color: string;
  /** Paint's colour 2: what text is filled with. */
  fill: string;
  sizes: Record<SizedTool, number>;
  text: TextStyle;
}

export const DEFAULT_SKETCH_SETTINGS: SketchSettings = {
  tool: "pen",
  shape: "arrow",
  color: "#ed1c24",
  fill: "#ffffff",
  sizes: { pen: 4, highlighter: 20, eraser: 24, shape: 4 },
  text: {
    font: "Arial",
    points: 11,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: "left",
    filled: false,
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

/** Typed words as a text item, in the style the text box shows them in. */
export function textItem(settings: SketchSettings, text: string, at: Point, id = newItemId()): TextItem {
  return {
    id,
    kind: "text",
    text,
    at,
    color: settings.color,
    fill: settings.text.filled ? settings.fill : null,
    style: { ...settings.text },
  };
}

export function moveItem(item: Item, dx: number, dy: number): Item {
  const shift = (point: Point) => ({ x: point.x + dx, y: point.y + dy });
  if (item.kind === "stroke") return { ...item, points: item.points.map(shift) };
  if (item.kind === "shape") return { ...item, from: shift(item.from), to: shift(item.to) };
  return { ...item, at: shift(item.at) };
}

export function replaceItem(items: readonly Item[], next: Item): Item[] {
  return items.map((item) => (item.id === next.id ? next : item));
}
