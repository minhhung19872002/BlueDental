import type { TableColumnsType } from "antd";
import { Tag } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import {
  paymentChannelLabels,
  SALES_APPROVAL_STATUS,
  type SalesApprovalStatus,
} from "../api/financeApi";
import type { SalesEntryVm } from "../types/mock";
import { CashflowRowActions } from "./CashflowRowActions";

const APPROVAL_CONFIG: Record<SalesApprovalStatus, { color: string; label: () => string }> = {
  [SALES_APPROVAL_STATUS.NotRequired]: { color: "default", label: () => t("Không cần duyệt") },
  [SALES_APPROVAL_STATUS.Pending]: { color: "gold", label: () => t("Chờ duyệt") },
  [SALES_APPROVAL_STATUS.Approved]: { color: "green", label: () => t("Đã duyệt") },
  [SALES_APPROVAL_STATUS.Rejected]: { color: "red", label: () => t("Từ chối") },
};

export function approvalStatusLabel(status: SalesApprovalStatus): string {
  return APPROVAL_CONFIG[status].label();
}

export function ApprovalTag({ status }: { status: SalesApprovalStatus }) {
  const { color, label } = APPROVAL_CONFIG[status];
  return <Tag color={color}>{label()}</Tag>;
}

interface ColumnOptions {
  kind: "income" | "expense";
  onEdit: (entry: SalesEntryVm) => void;
}

const PATIENT_COLUMN: TableColumnsType<SalesEntryVm>[number] = {
  title: t("Khách hàng"),
  dataIndex: "patientLabel",
  width: 200,
  render: (v: string | null) => (v ? <span className="report-patient-link">{v}</span> : "—"),
};

/**
 * Column set for Thu nhập / Chi phí. The reference's income table has no
 * "Ngày thực thu": the customer sits right after "Ngày tạo" and the headers
 * are the income-specific "Nội dung thu / Nhân viên thu / Doanh thu". The
 * expense table keeps the generic headers plus "Ngày thực chi" and approval.
 */
export function buildSalesEntryColumns({ kind, onEdit }: ColumnOptions): TableColumnsType<SalesEntryVm> {
  const channels = paymentChannelLabels();
  const isExpense = kind === "expense";
  const columns: TableColumnsType<SalesEntryVm> = [
    { title: t("Ngày tạo"), dataIndex: "entryDate", width: 110, render: (v: string) => formatDate(v) },
  ];

  if (isExpense) {
    columns.push({
      title: t("Ngày thực chi"),
      dataIndex: "paidDate",
      width: 120,
      render: (v: string) => formatDate(v),
    });
  } else {
    columns.push(PATIENT_COLUMN);
  }

  columns.push({ title: isExpense ? t("Nội dung") : t("Nội dung thu"), dataIndex: "description" });
  if (isExpense) columns.push(PATIENT_COLUMN);
  columns.push(
    { title: isExpense ? t("Nhân viên") : t("Nhân viên thu"), dataIndex: "staffName", width: 170 },
    { title: isExpense ? t("Mục chi") : t("Mục thu"), dataIndex: "categoryName", width: 150 },
    {
      title: isExpense ? t("Tổng tiền") : t("Doanh thu"),
      dataIndex: "amount",
      width: 130,
      align: "right",
      render: (v: number) => (
        <span className={`report-money ${isExpense ? "report-money--red" : "report-money--green"}`}>
          {formatVND(v)} đ
        </span>
      ),
    },
    {
      title: t("Hình thức"),
      dataIndex: "channel",
      width: 130,
      render: (v: SalesEntryVm["channel"]) => channels[v],
    },
  );

  if (isExpense) {
    columns.push({
      title: t("Trạng thái"),
      dataIndex: "approvalStatus",
      width: 120,
      render: (v: SalesApprovalStatus) => <ApprovalTag status={v} />,
    });
  }

  columns.push({
    title: t("Thao tác"),
    key: "actions",
    width: 200,
    fixed: "right",
    render: (_: unknown, entry) => <CashflowRowActions entry={entry} onEdit={onEdit} />,
  });

  return columns;
}
