import type { Item, Point } from "./sketch";
import { boundsOf } from "./sketchPaint";

/** How close, in page pixels, a press must land to an item's ink to pick it. */
export const HIT_SLOP = 10;

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + along * dx), point.y - (a.y + along * dy));
}

export function distanceToPolyline(point: Point, points: readonly Point[]): number {
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let nearest = Infinity;
  for (let at = 1; at < points.length; at += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, points[at - 1], points[at]));
  }
  return nearest;
}

/**
 * Whether a press at `point`, reaching `slop` around it, lands on the item's
 * ink. An outlined shape is picked by its outline, not its empty middle — what
 * is under it must stay reachable — while words are picked anywhere in their box.
 */
export function touches(item: Item, point: Point, slop = HIT_SLOP): boolean {
  if (item.kind === "text") {
    const box = boundsOf(item);
    return (
      point.x >= box.x - slop && point.x <= box.x + box.width + slop &&
      point.y >= box.y - slop && point.y <= box.y + box.height + slop
    );
  }

  const reach = item.size / 2 + slop;
  if (item.kind === "stroke") return distanceToPolyline(point, item.points) <= reach;

  const { from, to } = item;
  if (item.shape === "line" || item.shape === "arrow") return distanceToSegment(point, from, to) <= reach;

  if (item.shape === "rect") {
    const corners = [from, { x: to.x, y: from.y }, to, { x: from.x, y: to.y }, from];
    return distanceToPolyline(point, corners) <= reach;
  }

  // Ellipse: how far off the outline, scaled back to page pixels.
  const rx = Math.abs(to.x - from.x) / 2;
  const ry = Math.abs(to.y - from.y) / 2;
  if (rx < 1 || ry < 1) return distanceToSegment(point, from, to) <= reach;
  const nx = (point.x - (from.x + to.x) / 2) / rx;
  const ny = (point.y - (from.y + to.y) / 2) / ry;
  return Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry) <= reach;
}

/** Whether the eraser has rubbed out the item at `point`. */
function rubbedOutAt(item: Item, point: Point): boolean {
  return item.cuts?.some((cut) => distanceToPolyline(point, cut.points) <= cut.size / 2) ?? false;
}

/**
 * The topmost item under the pointer — the last one drawn wins, as it is on
 * top. Where the eraser has been there is nothing of an item left to pick.
 */
export function itemAt(items: readonly Item[], point: Point, slop = HIT_SLOP): Item | null {
  for (let at = items.length - 1; at >= 0; at -= 1) {
    if (touches(items[at], point, slop) && !rubbedOutAt(items[at], point)) return items[at];
  }
  return null;
}
