import {
  PAGE_PX_PER_POINT,
  SKETCH_LINE_HEIGHT,
  type Item,
  type Point,
  type Scene,
  type TextItem,
  type TextStyle,
} from "./sketch";

/** How much of the page shows through a highlighter. */
const HIGHLIGHTER_ALPHA = 0.4;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fontOf(style: TextStyle): string {
  const px = style.points * PAGE_PX_PER_POINT;
  return `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${px}px "${style.font}", sans-serif`;
}

let measurer: CanvasRenderingContext2D | null = null;

/** Where each line of a text item sits, measured in the font it is drawn in. */
export function layoutText(item: TextItem) {
  measurer ??= document.createElement("canvas").getContext("2d");
  const px = item.style.points * PAGE_PX_PER_POINT;
  const lineHeight = px * SKETCH_LINE_HEIGHT;
  if (measurer) measurer.font = fontOf(item.style);

  const widths = item.text.split("\n").map((line) => ({ line, width: measurer?.measureText(line).width ?? 0 }));
  const width = Math.max(...widths.map((entry) => entry.width), px / 2);
  const lines = widths.map(({ line, width: own }) => {
    const free = width - own;
    const indent = item.style.align === "center" ? free / 2 : item.style.align === "right" ? free : 0;
    return { line, x: item.at.x + indent, width: own };
  });
  return { px, lineHeight, width, height: lines.length * lineHeight, lines };
}

function paintText(ctx: CanvasRenderingContext2D, item: TextItem) {
  const { px, lineHeight, width, height, lines } = layoutText(item);
  if (item.fill) {
    ctx.fillStyle = item.fill;
    ctx.fillRect(item.at.x, item.at.y, width, height);
  }

  ctx.font = fontOf(item.style);
  ctx.fillStyle = item.color;
  ctx.textBaseline = "top";
  // A line box is taller than its letters; they sit in its middle, as they do
  // in the box they were typed into.
  const lead = (lineHeight - px) / 2;
  const rule = Math.max(1, px / 14);

  lines.forEach(({ line, x, width: own }, at) => {
    const top = item.at.y + at * lineHeight + lead;
    ctx.fillText(line, x, top);
    if (item.style.underline) ctx.fillRect(x, top + px * 0.95, own, rule);
    if (item.style.strike) ctx.fillRect(x, top + px * 0.55, own, rule);
  });
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

export function paintItem(ctx: CanvasRenderingContext2D, item: Item) {
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

/** The whole drawing afresh; `hidden` is left out — the item being typed over. */
export function paintScene(
  ctx: CanvasRenderingContext2D,
  backdrop: CanvasImageSource | null,
  scene: Scene,
  hidden?: string,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (scene.backdrop && backdrop) ctx.drawImage(backdrop, 0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const item of scene.items) if (item.id !== hidden) paintItem(ctx, item);
}

export function boundsOf(item: Item): Bounds {
  if (item.kind === "text") {
    const { width, height } = layoutText(item);
    return { x: item.at.x, y: item.at.y, width, height };
  }
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
