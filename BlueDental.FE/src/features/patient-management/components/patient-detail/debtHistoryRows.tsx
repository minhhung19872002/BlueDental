import type { RecordCardRow } from "@/components/RecordCard";
import {
  debtMovementLabels,
  isDebtCredit,
  type DebtHistoryEntryDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";

/**
 * "Số tiền" as the reference prints it: the sign comes from the kind of
 * movement, the colour from the sign, and the figure itself is never negative
 * on the page.
 */
export function DebtAmount({ entry }: { entry: DebtHistoryEntryDto }) {
  const credit = isDebtCredit(entry.type, entry.amount);
  return (
    <span className={credit ? "pd-debt-amount pd-debt-amount--in" : "pd-debt-amount"}>
      {credit ? "+" : "-"}
      {formatMoneyUnit(Math.abs(entry.amount))}
    </span>
  );
}

/** Empty cells read "-" on the reference, not an em dash. */
export function dashOrValue(value: string | null): string {
  return value ?? "-";
}

/**
 * The movement folded into a card below 769px: four rows on the face, the note
 * behind "Xem thêm", the same fold the reference uses.
 */
export function debtCardRows(entry: DebtHistoryEntryDto): {
  rows: RecordCardRow[];
  moreRows: RecordCardRow[];
} {
  const labels = debtMovementLabels();
  return {
    rows: [
      { key: "date", label: t("Patient:Debt:Date"), value: formatDateTime(entry.date) },
      { key: "type", label: t("Patient:Debt:Type"), value: labels[entry.type] },
      { key: "amount", label: t("Patient:Debt:Amount"), value: <DebtAmount entry={entry} /> },
      { key: "staff", label: t("Patient:Debt:Staff"), value: dashOrValue(entry.staffName) },
    ],
    moreRows: [{ key: "note", label: t("Patient:Debt:Note"), value: dashOrValue(entry.note) }],
  };
}
