import type { TableColumnsType } from "antd";
import { Tag } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  paymentChannelLabels,
  SALES_APPROVAL_STATUS,
  type SalesApprovalStatus,
  type SalesEntryDto,
} from "../api/financeApi";
import { CashflowRowActions } from "./CashflowRowActions";

const APPROVAL_CONFIG: Record<SalesApprovalStatus, { color: string; label: () => string }> = {
  [SALES_APPROVAL_STATUS.NotRequired]: { color: "default", label: () => t("Không cần duyệt") },
  [SALES_APPROVAL_STATUS.Pending]: { color: "gold", label: () => t("Dự chi") },
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
  onEdit: (entry: SalesEntryDto) => void;
}

/** The reference links the patient as "[code] - name"; a voucher without one reads "Không có". */
export function salesEntryCustomerLabel(row: SalesEntryDto): string {
  if (!row.patientName) return t("Không có");
  return row.patientCode ? `[${row.patientCode}] - ${row.patientName}` : row.patientName;
}

/** Column widths of the reference tables (its `minWidth`s), income then expense. */
const INCOME_WIDTHS = { date: 140, customer: 150, staff: 170, category: 140, amount: 150, channel: 150 };
const EXPENSE_WIDTHS = { date: 130, actualDate: 140, customer: 150, staff: 150, category: 140, amount: 150, channel: 150, status: 120 };

export function buildSalesEntryColumns({ kind, onEdit }: ColumnOptions): TableColumnsType<SalesEntryDto> {
  const isExpense = kind === "expense";
  const widths = isExpense ? EXPENSE_WIDTHS : INCOME_WIDTHS;
  // Only a linked patient shows here (the typed payer / receiver stays in the dialog and the Excel file).
  const patientColumn: TableColumnsType<SalesEntryDto>[number] = {
    title: t("Khách hàng"),
    key: "customer",
    width: widths.customer,
    render: (_: unknown, row) =>
      row.patientName ? (
        <span className="report-patient-link">{salesEntryCustomerLabel(row)}</span>
      ) : (
        <span className="report-muted">{t("Không có")}</span>
      ),
  };
  const channels = paymentChannelLabels();
  const columns: TableColumnsType<SalesEntryDto> = [
    { title: t("Ngày tạo"), dataIndex: "entryDate", width: widths.date, render: (v: string) => formatDate(v) },
  ];

  if (isExpense) {
    columns.push({
      title: t("Ngày thực chi"),
      dataIndex: "entryDate",
      width: EXPENSE_WIDTHS.actualDate,
      render: (v: string) => formatDate(v),
    });
  } else {
    columns.push(patientColumn);
  }

  columns.push({ title: isExpense ? t("Nội dung") : t("Nội dung thu"), dataIndex: "description" });
  if (isExpense) columns.push(patientColumn);
  columns.push(
    { title: isExpense ? t("Nhân viên") : t("Nhân viên thu"), dataIndex: "staffName", width: widths.staff },
    { title: isExpense ? t("Mục chi") : t("Mục thu"), dataIndex: "categoryName", width: widths.category },
    {
      title: isExpense ? t("Tổng tiền") : t("Doanh thu"),
      dataIndex: "amount",
      width: widths.amount,
      align: "right",
      render: (v: number) => (
        <span className={`report-money ${isExpense ? "report-money--red" : "report-money--green"}`}>
          {formatMoneyUnit(v)}
        </span>
      ),
    },
    {
      title: t("Hình thức"),
      dataIndex: "channel",
      width: widths.channel,
      render: (v: SalesEntryDto["channel"]) => channels[v],
    },
  );

  if (isExpense) {
    columns.push({
      title: t("Trạng thái"),
      dataIndex: "approvalStatus",
      width: EXPENSE_WIDTHS.status,
      render: (v: SalesApprovalStatus) => <ApprovalTag status={v} />,
    });
  }

  // The reference declares 70px and lets its sticky cell grow; four round buttons need the room.
  columns.push({
    title: t("Thao tác"),
    key: "actions",
    width: isExpense ? 180 : 100,
    align: "center",
    fixed: "right",
    render: (_: unknown, entry) => <CashflowRowActions entry={entry} onEdit={onEdit} />,
  });

  return columns;
}
