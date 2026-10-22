import type { Dayjs } from "dayjs";

/** The first and last day of the unit one grid cell stands for. */
export interface CellSpan {
  start: Dayjs;
  end: Dayjs;
}

interface CellFlags {
  /** A day of the neighbouring month, or a year outside the block shown. */
  outside?: boolean;
  /** Today, or the unit holding it. */
  current?: boolean;
}

/**
 * One grid cell's classes against the highlighted range. The range is made
 * of whole units of the cell's grain, so a cell is either in it or out.
 */
export function rangeCellClass(cell: CellSpan, from: Dayjs, to: Dayjs, flags: CellFlags = {}): string {
  const inside = !cell.start.isBefore(from, "day") && !cell.end.isAfter(to, "day");

  return [
    "bd-prp-cell",
    inside && "bd-prp-cell--in",
    inside && cell.start.isSame(from, "day") && "bd-prp-cell--start",
    inside && cell.end.isSame(to, "day") && "bd-prp-cell--end",
    flags.outside && "bd-prp-cell--outside",
    flags.current && "bd-prp-cell--current",
  ]
    .filter(Boolean)
    .join(" ");
}
