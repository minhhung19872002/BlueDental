import type { QrCorners } from "./qrDecoder";

/**
 * Decides which located codes are worth drawing a box around.
 *
 * A code ZXing reads always comes with its true outline. A code it finds but
 * cannot read yet usually does too — but now and then, on a blurred frame, it
 * reports a patch inside the code a third of the size. Drawn as they come,
 * those make the box shrink and grow from frame to frame. So an unread sighting
 * is only believed when it is square-ish and about the size of the last
 * believed one; with nothing believed recently, two frames in a row must agree
 * before the box appears.
 */

type Point = { x: number; y: number };

/** An unread sighting may differ this much in size from the last trusted one. */
const SIZE_TOLERANCE = 0.25;
/** Two frames agree on a fresh sighting when this close in size… */
const CONFIRM_TOLERANCE = 0.15;
/** …and their centres are within this fraction of the side. */
const CONFIRM_DRIFT = 0.5;
/** A trusted size is only a reference for this long. */
const TRUST_MS = 1500;
const CONFIRM_MS = 500;
/** Beyond these a quad is not a QR seen roughly face-on. */
const MAX_EDGE_RATIO = 1.4;
const MAX_DIAGONAL_RATIO = 1.3;

interface Shape {
  side: number;
  center: Point;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The quad in pixels, or null when it is too skewed to be a QR. */
function shapeOf(corners: QrCorners, width: number, height: number): Shape | null {
  const points = corners.map((p) => ({ x: p.x * width, y: p.y * height }));
  const edges = points.map((p, i) => distance(p, points[(i + 1) % points.length]));
  const diagonals = [distance(points[0], points[2]), distance(points[1], points[3])];

  const shortest = Math.min(...edges);
  if (shortest <= 0) return null;
  if (Math.max(...edges) / shortest > MAX_EDGE_RATIO) return null;
  if (Math.max(...diagonals) / Math.min(...diagonals) > MAX_DIAGONAL_RATIO) return null;

  return {
    side: edges.reduce((sum, edge) => sum + edge, 0) / edges.length,
    center: {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    },
  };
}

export class SightingFilter {
  private readonly width: number;
  private readonly height: number;
  private trusted: (Shape & { at: number }) | null = null;
  private pending: (Shape & { at: number }) | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** Whether this filter was made for frames of this size. */
  matches(width: number, height: number): boolean {
    return this.width === width && this.height === height;
  }

  /** The corners to draw for this frame's sighting, or null to ignore it. */
  accept(corners: QrCorners, read: boolean, now: number): QrCorners | null {
    const shape = shapeOf(corners, this.width, this.height);
    if (!shape) return null;

    const trusted = this.trusted && now - this.trusted.at < TRUST_MS ? this.trusted : null;
    const believable =
      read ||
      (trusted
        ? Math.abs(shape.side / trusted.side - 1) <= SIZE_TOLERANCE
        : this.confirms(shape, now));

    if (!believable) {
      if (!trusted) this.pending = { ...shape, at: now };
      return null;
    }

    this.trusted = { ...shape, at: now };
    this.pending = null;
    return corners;
  }

  /** A fresh sighting counts once the frame before saw the same thing. */
  private confirms(shape: Shape, now: number): boolean {
    const previous = this.pending;
    if (!previous || now - previous.at > CONFIRM_MS) return false;
    return (
      Math.abs(shape.side / previous.side - 1) <= CONFIRM_TOLERANCE &&
      distance(shape.center, previous.center) <= previous.side * CONFIRM_DRIFT
    );
  }
}
