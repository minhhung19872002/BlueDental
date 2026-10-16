import { SKETCH_HEIGHT, SKETCH_WIDTH, type Cut, type Item, type Point, type Scene } from "./sketch";
import { paintText, textBoxOf } from "./sketchText";

/** How much of the page shows through a highlighter. */
const HIGHLIGHTER_ALPHA = 0.4;
/** Below this, what the eraser left of an item cannot be seen, and the item is gone. */
const FAINTEST_INK = 32;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
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

  // Straight through every sample, as the ink was laid while drawing — the
  // samples are dense enough to read as a curve, and a smoothed path would
  // shift the stroke at the moment it is let go.
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function shapePath(ctx: CanvasRenderingContext2D, item: Extract<Item, { kind: "shape" }>) {
  const { from, to, size } = item;
  ctx.beginPath();

  if (item.shape === "rect") {
    ctx.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  } else if (item.shape === "ellipse") {
    const rx = Math.abs(to.x - from.x) / 2;
    const ry = Math.abs(to.y - from.y) / 2;
    ctx.ellipse((from.x + to.x) / 2, (from.y + to.y) / 2, rx, ry, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    if (item.shape === "arrow" && (from.x !== to.x || from.y !== to.y)) {
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

function paintInk(ctx: CanvasRenderingContext2D, item: Item) {
  ctx.save();
  if (item.kind === "text") {
    paintText(ctx, item);
  } else {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = item.size;
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    if (item.kind === "shape") shapePath(ctx, item);
    else {
      // One path stroked once: where a highlighter crosses itself it does not darken.
      if (item.tool === "highlighter") ctx.globalAlpha = HIGHLIGHTER_ALPHA;
      strokePath(ctx, item.points, item.size);
    }
  }
  ctx.restore();
}

/**
 * Rubs a pass of the eraser out of what is already on `ctx`, as Paint's does.
 * From the sample `from` on, joined on from the one before: while the eraser
 * is moving, only the stretch it has just gone over.
 */
export function paintCut(ctx: CanvasRenderingContext2D, cut: Cut, from = 0) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = cut.size;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  strokePath(ctx, cut.points.slice(Math.max(0, from - 1)), cut.size);
  ctx.restore();
}

/** A sheet the size of the page, where a thing is painted and the eraser's cuts rubbed out of it alone. */
let scratch: CanvasRenderingContext2D | null = null;

function cutOut(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, cuts: readonly Cut[]) {
  if (!scratch) scratch = document.createElement("canvas").getContext("2d");
  if (!scratch) return null;
  if (scratch.canvas.width !== width || scratch.canvas.height !== height) {
    scratch.canvas.width = width;
    scratch.canvas.height = height;
  }
  scratch.clearRect(0, 0, width, height);
  paint(scratch);
  for (const cut of cuts) paintCut(scratch, cut);
  return scratch;
}

/** An item as the eraser has left it. */
export function paintItem(ctx: CanvasRenderingContext2D, item: Item) {
  const cuts = item.cuts ?? [];
  const sheet = cuts.length ? cutOut(ctx.canvas.width, ctx.canvas.height, (on) => paintInk(on, item), cuts) : null;
  if (sheet) ctx.drawImage(sheet.canvas, 0, 0);
  else paintInk(ctx, item);
}

/** Whether anything of the item can still be seen once the eraser's cuts are taken out of it. */
export function leavesInk(item: Item): boolean {
  const sheet = cutOut(SKETCH_WIDTH, SKETCH_HEIGHT, (on) => paintInk(on, item), item.cuts ?? []);
  if (!sheet) return true;
  const pad = 4;
  const bounds = boundsOf(item);
  const x = Math.max(0, Math.floor(bounds.x - pad));
  const y = Math.max(0, Math.floor(bounds.y - pad));
  const width = Math.min(SKETCH_WIDTH, Math.ceil(bounds.x + bounds.width + pad)) - x;
  const height = Math.min(SKETCH_HEIGHT, Math.ceil(bounds.y + bounds.height + pad)) - y;
  if (width <= 0 || height <= 0) return false;
  const { data } = sheet.getImageData(x, y, width, height);
  for (let at = 3; at < data.length; at += 4) if (data[at] >= FAINTEST_INK) return true;
  return false;
}

/** The whole drawing afresh; `hidden` is left out — the item being typed over. */
export function paintScene(
  ctx: CanvasRenderingContext2D,
  backdrop: CanvasImageSource | null,
  scene: Scene,
  hidden?: string,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (scene.backdrop && backdrop) {
    const cuts = scene.backdropCuts ?? [];
    const lay = (on: CanvasRenderingContext2D) => on.drawImage(backdrop, 0, 0, width, height);
    const sheet = cuts.length ? cutOut(width, height, lay, cuts) : null;
    if (sheet) ctx.drawImage(sheet.canvas, 0, 0);
    else lay(ctx);
  }
  for (const item of scene.items) if (item.id !== hidden) paintItem(ctx, item);
}

export function boundsOf(item: Item): Bounds {
  if (item.kind === "text") return textBoxOf(item);
  const points = item.kind === "stroke" ? item.points : [item.from, item.to];
  const reach = item.kind === "shape" && item.shape === "arrow" ? Math.max(12, item.size * 3.5) : item.size / 2;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs) - reach;
  const y = Math.min(...ys) - reach;
  return { x, y, width: Math.max(...xs) + reach - x, height: Math.max(...ys) + reach - y };
}

/** The dashed frame and corner marks around what is selected. */
export function paintSelection(ctx: CanvasRenderingContext2D, bounds: Bounds) {
  const pad = 8;
  const { x, y, width, height } = { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
  ctx.save();
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  for (const [cx, cy] of [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]) {
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.strokeRect(cx - 5, cy - 5, 10, 10);
  }
  ctx.restore();
}

/** Whether anything at all is left on the page. */
export function hasInk(ctx: CanvasRenderingContext2D): boolean {
  const { data } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let at = 3; at < data.length; at += 4) if (data[at] !== 0) return true;
  return false;
}
