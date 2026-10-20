/**
 * The one status palette.
 *
 * Colours are the design's own `statusColor` map from BlueDental v2.dc.html.
 * Note which is which: a cancelled appointment is amber and a late one is red —
 * the design reads a cancellation as something to notice and a no-show as
 * something gone wrong, not the other way round.
 *
 * Five components used to carry their own copy of these triplets and had
 * drifted apart. Anything that draws a status chip reads them from here.
 */

export type StatusKey =
  | "scheduled"
  | "arrived"
  | "cancelled"
  | "late"
  | "temporary"
  | "converted";

/** The accent itself: chip text, card left border, calendar block edge. */
export const STATUS_COLOR: Record<StatusKey, string> = {
  scheduled: "#6366f1",
  arrived: "#0e9f6e",
  cancelled: "#d98b0f",
  late: "#e5484d",
  temporary: "#7c5ce0",
  converted: "#0e94d0",
} as const;

/** The accent laid over white — 12% for a fill, 35% for a hairline. */
export interface StatusTone {
  bg: string;
  border: string;
  color: string;
}

export const STATUS_TONE: Record<StatusKey, StatusTone> = {
  scheduled: { bg: "#eceefd", border: "#c8cafa", color: "#6366f1" },
  arrived: { bg: "#e2f4ee", border: "#abddcc", color: "#0e9f6e" },
  cancelled: { bg: "#faf1e2", border: "#f2d6ab", color: "#d98b0f" },
  late: { bg: "#fce9ea", border: "#f6bfc1", color: "#e5484d" },
  temporary: { bg: "#efebfb", border: "#d1c6f4", color: "#7c5ce0" },
  converted: { bg: "#e2f2f9", border: "#abd9ee", color: "#0e94d0" },
} as const;
