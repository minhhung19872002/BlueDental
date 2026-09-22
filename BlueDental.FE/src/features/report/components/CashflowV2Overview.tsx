import { useCallback, useMemo, useState } from "react";
import type { TablePaginationConfig } from "antd";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t, tRich } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatMoneyUnit } from "@/utils/format";
import { useCashBalance, useDeleteCashflowEntry, type CashBalanceDto, type CashflowEntryDto } from "../api/financeApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { BalancePanels } from "./BalancePanels";
import { CashflowEntryDetailModal } from "./CashflowEntryDetailModal";
import { buildLedgerColumns } from "./cashflowLedgerColumns";
import { ReportTableCard } from "./ReportTableCard";
import type { StatTone } from "./ReportStatCards";

interface Props {
  rows: CashflowEntryDto[];
  loading: boolean;
  pagination: TablePaginationConfig;
  onEdit: (entry: CashflowEntryDto) => void;
}

/** Two lines under the balance panels, both served by the cash balance; the reference colours them green and violet. */
const SUMMARY_LINES: { key: keyof CashBalanceDto; label: () => string; tone: StatTone }[] = [
  { key: "serviceRevenue", label: () => t("Doanh thu dịch vụ"), tone: "green" },
  { key: "cardPending", label: () => t("Cà thẻ chờ đối soát"), tone: "violet" },
];

/** "Tổng quan" of tab 4: balance panels, two summary lines, transaction table. */
export function CashflowV2Overview({ rows, loading, pagination, onEdit }: Props) {
  const branchId = useCurrentBranchId();
  const { data: balance } = useCashBalance(branchId);
  const [deleting, setDeleting] = useState<CashflowEntryDto | null>(null);
  const [viewing, setViewing] = useState<CashflowEntryDto | null>(null);
  const canEdit = useReportPermission(REPORT_PERMISSION.transferUpdate);
  const canDelete = useReportPermission(REPORT_PERMISSION.transferDelete);

  const closeDelete = useCallback(() => setDeleting(null), []);
  const closeView = useCallback(() => setViewing(null), []);
  const deleteMutation = useDeleteCashflowEntry();
  const handleDelete = useCallback(() => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t("Đã hủy giao dịch"));
        setDeleting(null);
      },
    });
  }, [deleting, deleteMutation]);

  const columns = useMemo(
    () => buildLedgerColumns({ onView: setViewing, onEdit, onDelete: setDeleting, canEdit, canDelete }),
    [onEdit, canEdit, canDelete],
  );

  return (
    <>
      <BalancePanels balance={balance} />
      {SUMMARY_LINES.map((line) => (
        <div key={line.key} className="report-service-revenue">
          <span>{line.label()}</span>
          <span className={`report-money report-money--${line.tone}`}>{formatMoneyUnit(balance?.[line.key] ?? 0)}</span>
        </div>
      ))}
      <ReportTableCard<CashflowEntryDto>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={pagination}
        countUnit={t("giao dịch")}
      />
      <CashflowEntryDetailModal entry={viewing} onClose={closeView} />
      {/* The reference calls this "hủy" (cancel), not "xoá". Wording = owner's decision 2026-09-22 (dialog never opened on staging). */}
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("giao dịch")}
        title={t("Xác nhận hủy giao dịch")}
        question={
          deleting?.note
            ? tRich("Bạn có chắc muốn hủy giao dịch {0} không?", <strong>{deleting.note}</strong>)
            : t("Bạn có chắc muốn hủy giao dịch này không?")
        }
        confirmLabel={t("Hủy giao dịch")}
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
