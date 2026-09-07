import { t } from "@/lib/i18n";
import {
  SERVICE_LINE_STATUS,
  type TreatmentServiceStatus,
} from "@/features/treatment-management/api/treatmentPlanApi";

/**
 * The status a treatment-table row shows.
 *
 * OBSERVED on the reference 2026-09-07: each `patient-timeline` row carries its
 * **own** `status`, not the line's, and only three values reached the surveyed
 * patient — `replaced`, `done` and `created`. Their labels are what the chip
 * prints, and note the third: a `created` row reads **"Đang điều trị"**, not
 * "Chưa điều trị". Two rows of the same line were seen reading "Hoàn thành" and
 * "Đang điều trị" at once, which is what says the status is per row.
 */
export const STAGE_ROW_STATUS = {
  Active: "active",
  Done: "done",
  Replaced: "replaced",
  Cancelled: "cancelled",
} as const;

export type StageRowStatus = (typeof STAGE_ROW_STATUS)[keyof typeof STAGE_ROW_STATUS];

/**
 * The status for one row, from its công đoạn and the line it belongs to.
 *
 * BlueDental keeps `replaced` / `cancelled` on the **service line** rather than
 * on each công đoạn, so those two are read from the line and apply to every row
 * of it — which matches the reference, where both rows of a converted line read
 * "Chuyển đổi". The other two come from the row's own công đoạn.
 */
export function stageRowStatus(
  lineStatus: TreatmentServiceStatus | null,
  stageDone: boolean,
): StageRowStatus {
  if (lineStatus === SERVICE_LINE_STATUS.Replaced) return STAGE_ROW_STATUS.Replaced;
  if (lineStatus === SERVICE_LINE_STATUS.Cancelled) return STAGE_ROW_STATUS.Cancelled;
  return stageDone ? STAGE_ROW_STATUS.Done : STAGE_ROW_STATUS.Active;
}

/** Depends on `t()`, so it is a function rather than a module constant. */
export function stageRowStatusLabel(status: StageRowStatus): string {
  const labels: Record<StageRowStatus, string> = {
    [STAGE_ROW_STATUS.Active]: t("Đang điều trị"),
    [STAGE_ROW_STATUS.Done]: t("Hoàn thành"),
    [STAGE_ROW_STATUS.Replaced]: t("Chuyển đổi"),
    [STAGE_ROW_STATUS.Cancelled]: t("Đã huỷ"),
  };
  return labels[status];
}
