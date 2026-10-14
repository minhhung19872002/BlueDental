/**
 * The drawing pad behind "Lược đồ phẫu thuật/thủ thuật": what can be drawn, and
 * how each mark is painted.
 *
 * A drawing is kept as the list of marks made on it, not as pixels, so undo is
 * a replay of one mark fewer. The picture a sheet already had is the backdrop
 * the marks are painted over. The tools follow Windows' Snipping Tool, which
 * the clinic pointed at: a pen, a highlighter, an eraser and shapes, each with
 * a colour and a size.
 */

export interface Point {
  x: number;
  y: number;
}

export type SketchTool = "pen" | "highlighter" | "eraser" | "shape";
export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";

export type Mark =
  | { kind: "stroke"; tool: "pen" | "highlighter" | "eraser"; color: string; size: number; points: Point[] }
  | { kind: "shape"; shape: ShapeKind; color: string; size: number; from: Point; to: Point }
  /** "Xoá tất cả" — everything before it, the backdrop included, is gone. */
  | { kind: "clear" };

/**
 * The page the doctor draws on, in canvas pixels. Three times the cell it is
 * printed into (334 × 219 CSS px on A4, measured), so the picture stays sharp on
 * paper and at 140% zoom.
 */
export const SKETCH_WIDTH = 1002;
export const SKETCH_HEIGHT = 657;

/** Snipping Tool's own thirty, row by row. */
export const SKETCH_COLORS = [
  "#000000", "#ffffff", "#d1d1d1", "#a0a0a0", "#808080", "#555555",
  "#b4155f", "#e81c1c", "#ff5500", "#ffaa00", "#ffcc00", "#ffe500",
  "#a5e01a", "#22d300", "#00845a", "#00a8c6", "#0050e6", "#3d00c2",
  "#7000d6", "#6a0082", "#f7d7c4", "#bb9167", "#8e562e", "#613d30",
  "#ff7eff", "#ffc47e", "#ffff80", "#80ff9f", "#80d9ff", "#b9b9ff",
] as const;

export interface SizeRange {
  min: number;
  max: number;
}

export const SIZE_RANGE: Record<SketchTool, SizeRange> = {
  pen: { min: 1, max: 24 },
  highlighter: { min: 6, max: 48 },
  eraser: { min: 6, max: 80 },
  shape: { min: 1, max: 24 },
};

/** How much of the page shows through a highlighter. */
const HIGHLIGHTER_ALPHA = 0.4;

export interface ToolStyle {
  color: string;
  size: number;
}

export interface SketchSettings {
  tool: SketchTool;
  shape: ShapeKind;
  pen: ToolStyle;
  highlighter: ToolStyle;
  eraser: { size: number };
  shapeStyle: ToolStyle;
}

export const DEFAULT_SKETCH_SETTINGS: SketchSettings = {
  tool: "pen",
  shape: "arrow",
  pen: { color: "#e81c1c", size: 4 },
  highlighter: { color: "#ffe500", size: 20 },
  eraser: { size: 24 },
  shapeStyle: { color: "#e81c1c", size: 4 },
};

/** The mark a press of the pointer starts, with the tool as it is set now. */
export function startMark(settings: SketchSettings, at: Point): Mark {
  if (settings.tool === "shape") {
    const { color, size } = settings.shapeStyle;
    return { kind: "shape", shape: settings.shape, color, size, from: at, to: at };
  }
  if (settings.tool === "eraser") {
    return { kind: "stroke", tool: "eraser", color: "#000000", size: settings.eraser.size, points: [at] };
  }
  const { color, size } = settings[settings.tool];
  return { kind: "stroke", tool: settings.tool, color, size, points: [at] };
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[], size: number) {
  const [first] = points;
  if (points.length === 1) {
    // A tap leaves a dot, as it does on paper.
    ctx.beginPath();
    ctx.arc(first.x, first.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Through the midpoints, so a quick stroke reads as a curve, not a polygon.
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let at = 1; at < points.length - 1; at += 1) {
    const here = points[at];
    const next = points[at + 1];
    ctx.quadraticCurveTo(here.x, here.y, (here.x + next.x) / 2, (here.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function shapePath(ctx: CanvasRenderingContext2D, mark: Extract<Mark, { kind: "shape" }>) {
  const { from, to, size } = mark;
  ctx.beginPath();

  if (mark.shape === "rect") {
    ctx.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  } else if (mark.shape === "ellipse") {
    ctx.ellipse(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.abs(to.x - from.x) / 2,
      Math.abs(to.y - from.y) / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    if (mark.shape === "arrow" && (from.x !== to.x || from.y !== to.y)) {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = Math.max(12, size * 3.5);
      for (const side of [-1, 1]) {
        const wing = angle + Math.PI - (side * Math.PI) / 7;
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x + head * Math.cos(wing), to.y + head * Math.sin(wing));
      }
    }
  }
  ctx.stroke();
}

/** Paints one mark onto a page. */
export function paintMark(ctx: CanvasRenderingContext2D, mark: Mark) {
  if (mark.kind === "clear") {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = mark.size;
  ctx.strokeStyle = mark.color;
  ctx.fillStyle = mark.color;

  if (mark.kind === "shape") {
    shapePath(ctx, mark);
  } else {
    // One path, stroked once: where a highlighter crosses itself it does not
    // darken, and an eraser takes the page back to bare.
    if (mark.tool === "highlighter") ctx.globalAlpha = HIGHLIGHTER_ALPHA;
    if (mark.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    strokePath(ctx, mark.points, mark.size);
  }
  ctx.restore();
}

/** Paints the whole drawing afresh: the backdrop, then every mark since the last "clear". */
export function paintAll(ctx: CanvasRenderingContext2D, backdrop: CanvasImageSource | null, marks: readonly Mark[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  let from = 0;
  for (let at = marks.length - 1; at >= 0; at -= 1) {
    if (marks[at].kind === "clear") {
      from = at + 1;
      break;
    }
  }

  if (from === 0 && backdrop) ctx.drawImage(backdrop, 0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const mark of marks.slice(from)) paintMark(ctx, mark);
}

/** Whether anything at all is left on the page. */
export function hasInk(ctx: CanvasRenderingContext2D): boolean {
  const { data } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let at = 3; at < data.length; at += 4) {
    if (data[at] !== 0) return true;
  }
  return false;
}
