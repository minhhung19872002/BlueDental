import { t } from "@/lib/i18n";

/**
 * Báo cáo is not one screen — each division draws it differently.
 *
 * Measured on the reference, 2026-08-26. The table and its visit grouping are
 * the same everywhere; what changes is which filters sit above it, where the
 * one figure goes, and whether the pager names what it is counting.
 *
 * Khối Marketing is not here at all: its Báo cáo is a different report with a
 * tab row of its own — see `docs/clone/pages/operations.md`.
 */
export type WorkLogFilter = "staff" | "actions" | "patient";

export interface WorkLogVariant {
  filters: WorkLogFilter[];
  /**
   * "right" pushes the figure to the far end of the filter row, "inline" sets
   * it immediately beside the one filter, "left" puts it on a row of its own
   * where there are no filters at all.
   */
  card: "right" | "inline" | "left";
  /** The pager says "68 công việc" on some divisions and plain "68" on others. */
  countNoun?: string;
}

const FULL: WorkLogVariant = {
  filters: ["staff", "actions", "patient"],
  card: "right",
  countNoun: "công việc",
};

const VARIANTS: Record<string, WorkLogVariant> = {
  overview: FULL,
  cskh: FULL,
  // Lễ tân narrows to one filter and sets the figure beside it, and its pager
  // names nothing.
  reception: { filters: ["staff"], card: "inline" },
  // Khối điều trị offers no filter at all.
  treatment: { filters: [], card: "left", countNoun: "công việc" },
};

/** Divisions the reference gives no Báo cáo variant of its own fall back to the full one. */
export function workLogVariantOf(division: string): WorkLogVariant {
  return VARIANTS[division] ?? FULL;
}

/** The pager summary this variant uses. */
export function workLogTotal(variant: WorkLogVariant) {
  return (total: number, shown: [number, number]) => {
    const noun = variant.countNoun ? ` ${t(variant.countNoun)}` : "";
    return total === 0
      ? t("Hiển thị 0 trên 0{0}", noun)
      : t("Hiển thị {0}–{1} trên {2}{3}", shown[0], shown[1], total, noun);
  };
}
