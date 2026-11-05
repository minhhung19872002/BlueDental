import type { ToothSurfaceSlot } from "./toothSurfaces";

/**
 * The surface circle of the dental chart (the BA's "như này" on tooth 18,
 * R-1150), drawn large in a 120 × 120 box: four wedges cut by the diagonals,
 * the biting face a disc in the middle.
 */
export interface ToothShape {
  outline: string;
  /** The biting face drawn over the four outer faces. */
  center: string;
  /** Where the four outer faces meet. */
  hub: readonly [number, number];
  /** Baselines of a surface's name and of its colour below it. */
  labels: Record<ToothSurfaceSlot, readonly [x: number, name: number, shade: number]>;
}

const circle = (r: number) => `M ${60 - r} 60 A ${r} ${r} 0 1 0 ${60 + r} 60 A ${r} ${r} 0 1 0 ${60 - r} 60 Z`;

export const TOOTH_CIRCLE: ToothShape = {
  outline: circle(58),
  center: circle(27),
  hub: [60, 60],
  labels: {
    top: [60, 15, 26],
    bottom: [60, 94, 105],
    left: [19, 55, 66],
    right: [101, 55, 66],
    center: [60, 55, 66],
  },
};

/** Width (viewBox units) a face's colour may take on its line without leaving the face. */
const SHADE_ROOM: Record<ToothSurfaceSlot, number> = { top: 60, bottom: 60, center: 46, left: 27, right: 27 };
/** Rough advance of one bold glyph at the .tsp-shade size and at .tsp-shade--small. */
const GLYPH = 6.3;
const GLYPH_SMALL = 5;

export interface FittedShade {
  text: string;
  small: boolean;
  /** The colour had to be cut: the face carries it whole in a tooltip. */
  cut: boolean;
}

/**
 * A long Màu (owner: "A43243" spilled over Gần) first takes the smaller size,
 * then is cut with "…" so it never leaves its face.
 */
export function fitShade(shade: string, slot: ToothSurfaceSlot): FittedShade {
  const room = SHADE_ROOM[slot];
  if (shade.length * GLYPH <= room) return { text: shade, small: false, cut: false };
  const fits = Math.floor(room / GLYPH_SMALL);
  if (shade.length <= fits) return { text: shade, small: true, cut: false };
  return { text: `${shade.slice(0, Math.max(1, fits - 1))}…`, small: true, cut: true };
}

/** An outer face: a triangle from the box's edge to the hub, cut by the outline. */
export function outerFace(slot: Exclude<ToothSurfaceSlot, "center">, [x, y]: readonly [number, number]): string {
  const corners: Record<typeof slot, string> = {
    top: `-10,-10 130,-10 ${x},${y}`,
    bottom: `-10,130 130,130 ${x},${y}`,
    left: `-10,-10 ${x},${y} -10,130`,
    right: `130,-10 ${x},${y} 130,130`,
  };
  return corners[slot];
}
