import type { Cut, Item, Point, Scene } from "./sketch";
import { touches } from "./sketchHit";
import { boundsOf, leavesInk, type Bounds } from "./sketchPaint";

/** The eraser's path, a sample at least every quarter of its width: a fast pass misses nothing between samples. */
function samplesOf({ size, points }: Cut): Point[] {
  const step = Math.max(1, size / 4);
  const samples = [points[0]];
  for (let at = 1; at < points.length; at += 1) {
    const from = points[at - 1];
    const to = points[at];
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    for (let k = 1; k <= steps; k += 1) {
      samples.push({ x: from.x + ((to.x - from.x) * k) / steps, y: from.y + ((to.y - from.y) * k) / steps });
    }
  }
  return samples;
}

function cutBounds({ size, points }: Cut): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs) - size / 2;
  const y = Math.min(...ys) - size / 2;
  return { x, y, width: Math.max(...xs) + size / 2 - x, height: Math.max(...ys) + size / 2 - y };
}

function overlap(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/**
 * The drawing after one pass of the eraser, as in Paint: every item it reached
 * keeps the pass as a cut, an item rubbed out entirely is gone, and a picture
 * under the items is rubbed out too. Null when the pass took nothing away.
 */
export function eraseScene(scene: Scene, cut: Cut): Scene | null {
  const reach = cutBounds(cut);
  const samples = samplesOf(cut);
  let reached = false;
  const items: Item[] = [];

  for (const item of scene.items) {
    if (!overlap(boundsOf(item), reach) || !samples.some((point) => touches(item, point, cut.size / 2))) {
      items.push(item);
      continue;
    }
    reached = true;
    const cutItem: Item = { ...item, cuts: [...(item.cuts ?? []), cut] };
    if (leavesInk(cutItem)) items.push(cutItem);
  }

  if (!reached && !scene.backdrop) return null;
  const backdropCuts = scene.backdrop ? [...(scene.backdropCuts ?? []), cut] : scene.backdropCuts;
  return { ...scene, items, backdropCuts };
}
