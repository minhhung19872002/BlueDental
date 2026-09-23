import { useCallback, useState } from "react";
import { Button, Tooltip } from "antd";
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PrinterOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t, tRich } from "@/lib/i18n";
import {
  SALES_APPROVAL_STATUS,
  SALES_ENTRY_TYPE,
  useApproveSalesEntry,
  useDeleteSalesEntry,
  type SalesEntryDto,
} from "../api/financeApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { ConfirmApproveDialog } from "./ConfirmApproveDialog";
import { SalesEntryDetailModal } from "./SalesEntryDetailModal";

interface Props {
  entry: SalesEntryDto;
  onEdit: (entry: SalesEntryDto) => void;
}

type ActionTone = "approve" | "danger" | "plain";

interface ActionButtonProps {
  title: string;
  icon: React.ReactNode;
  tone?: ActionTone;
  onClick: () => void;
}

function ActionButton({ title, icon, tone = "plain", onClick }: ActionButtonProps) {
  return (
    <Tooltip title={title}>
      <Button
        shape="circle"
        className={["report-row-action", tone !== "plain" && `report-row-action--${tone}`].filter(Boolean).join(" ")}
        icon={icon}
        aria-label={title}
        onClick={onClick}
      />
    </Tooltip>
  );
}

/**
 * The reference's per-row buttons on Thu nhập / Chi phí: a pending expense
 * can be approved, edited, deleted or printed; an approved expense can only
 * be printed; an income row can be edited or printed (there is no delete).
 * Each write button also needs its `reportCost` / `reportIncome` permission;
 * the printer is always there.
 */
export function CashflowRowActions({ entry, onEdit }: Props) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const mayApprove = useReportPermission(REPORT_PERMISSION.costApprove);
  const mayUpdateCost = useReportPermission(REPORT_PERMISSION.costUpdate);
  const mayDeleteCost = useReportPermission(REPORT_PERMISSION.costDelete);
  const mayUpdateIncome = useReportPermission(REPORT_PERMISSION.incomeUpdate);

  const isExpense = entry.type === SALES_ENTRY_TYPE.Expense;
  const isPendingExpense = isExpense && entry.approvalStatus === SALES_APPROVAL_STATUS.Pending;
  const canApprove = isPendingExpense && mayApprove;
  const canEdit = isExpense ? isPendingExpense && mayUpdateCost : mayUpdateIncome;
  const canDelete = isPendingExpense && mayDeleteCost;
  const printTitle = isExpense ? t("Report:Action:PrintExpense") : t("Report:Action:PrintIncome");

  const approveMutation = useApproveSalesEntry();
  const deleteMutation = useDeleteSalesEntry();

  const handleEdit = useCallback(() => onEdit(entry), [onEdit, entry]);
  const openApprove = useCallback(() => setApproveOpen(true), []);
  const closeApprove = useCallback(() => setApproveOpen(false), []);
  const openDelete = useCallback(() => setDeleteOpen(true), []);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);
  const openDetail = useCallback(() => setDetailOpen(true), []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);

  const handleApprove = useCallback(() => {
    approveMutation.mutate(entry.id, {
      onSuccess: () => {
        toast.success(t("Report:Action:ApproveSuccess"));
        setApproveOpen(false);
      },
    });
  }, [approveMutation, entry.id]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(entry.id, {
      onSuccess: () => {
        toast.success(t("Report:Action:DeleteSuccess"));
        setDeleteOpen(false);
      },
    });
  }, [deleteMutation, entry.id]);

  return (
    <>
      <div className="report-row-actions">
        {canApprove && (
          <ActionButton title={t("Report:Action:ApproveExpense")} icon={<CheckCircleOutlined />} tone="approve" onClick={openApprove} />
        )}
        {canEdit && <ActionButton title={t("Common:Edit")} icon={<EditOutlined />} onClick={handleEdit} />}
        {canDelete && <ActionButton title={t("Common:Delete")} icon={<DeleteOutlined />} tone="danger" onClick={openDelete} />}
        <ActionButton title={printTitle} icon={<PrinterOutlined />} onClick={openDetail} />
      </div>

      <ConfirmApproveDialog
        open={approveOpen}
        description={entry.description}
        pending={approveMutation.isPending}
        onConfirm={handleApprove}
        onClose={closeApprove}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        noun={t("Report:Unit:ExpenseSlip")}
        title={t("Report:ConfirmDeleteVoucher")}
        question={tRich("Report:Confirm:DeleteExpenseSlip", <strong>{entry.description}</strong>)}
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
      <SalesEntryDetailModal open={detailOpen} entry={entry} onClose={closeDetail} />
    </>
  );
}
