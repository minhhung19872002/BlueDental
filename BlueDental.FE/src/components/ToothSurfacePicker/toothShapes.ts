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
