import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";

/** "Hoàn thành 01/11/2026", or nothing while the line is not finished. */
export function completedOnText(row: WarrantyServiceRowDto): string | undefined {
  return row.completedOn ? t("Treatment:Warranty:CompletedOn", formatDate(row.completedOn)) : undefined;
}

/** The Danh mục days "Theo danh mục" runs, if the service has any. */
export function catalogDaysOf(row: WarrantyServiceRowDto): number | undefined {
  return row.warrantyDays > 0 ? row.warrantyDays : undefined;
}

/** Ngày bắt đầu cannot fall before the line was finished. */
export function completedDay(row: WarrantyServiceRowDto): Dayjs | null {
  return row.completedOn ? dayjs(row.completedOn) : null;
}
