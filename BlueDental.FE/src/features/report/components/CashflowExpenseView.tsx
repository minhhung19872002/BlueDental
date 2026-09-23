import { useMemo, useState } from "react";
import { Segmented } from "antd";
import { CheckOutlined, FallOutlined, WalletOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { SALES_APPROVAL_STATUS, SALES_ENTRY_TYPE, type SalesEntryDto } from "../api/financeApi";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportTableCard } from "./ReportTableCard";
import { buildSalesEntryColumns } from "./cashflowColumns";

type StatusFilter = "all" | "pending" | "approved";

const STATUS_FILTERS: { key: StatusFilter; label: () => string }[] = [
  { key: "all", label: () => t("Report:Filter:All") },
  { key: "pending", label: () => t("Report:ApprovalStatus:Pending") },
  { key: "approved", label: () => t("Report:ApprovalStatus:Approved") },
];

interface Props {
  entries: SalesEntryDto[];
  loading: boolean;
  onEdit: (entry: SalesEntryDto) => void;
}

const sum = (rows: SalesEntryDto[]) => rows.reduce((s, e) => s + e.amount, 0);

/** "Chi phí": 3 cards + status segmented (with counts) + voucher table. */
export function CashflowExpenseView({ entries, loading, onEdit }: Props) {
  const [status, setStatus] = useState<StatusFilter>("all");

  const expenses = useMemo(() => entries.filter((e) => e.type === SALES_ENTRY_TYPE.Expense), [entries]);
  const pending = useMemo(
    () => expenses.filter((e) => e.approvalStatus === SALES_APPROVAL_STATUS.Pending),
    [expenses],
  );
  const approved = useMemo(
    () => expenses.filter((e) => e.approvalStatus === SALES_APPROVAL_STATUS.Approved),
    [expenses],
  );

  const buckets: Record<StatusFilter, SalesEntryDto[]> = { all: expenses, pending, approved };
  const visible = buckets[status];
  const paging = useClientPaging(visible);
  const columns = useMemo(() => buildSalesEntryColumns({ kind: "expense", onEdit }), [onEdit]);

  // The reference's "Tổng chi phí" only counts approved vouchers (it equals Đã duyệt chi).
  const cards: StatCardItem[] = [
    { label: t("Report:ExpenseView:TotalExpense"), value: sum(approved), tone: "red", icon: <FallOutlined /> },
    { label: t("Report:ExpenseView:ApprovedTotal"), value: sum(approved), tone: "green", icon: <CheckOutlined /> },
    { label: t("Report:ExpenseView:PendingTotal"), value: sum(pending), tone: "gold", icon: <WalletOutlined /> },
  ];

  const segmentedOptions = STATUS_FILTERS.map((f) => ({
    value: f.key,
    label: `${f.label()} (${buckets[f.key].length})`,
  }));

  return (
    <>
      <ReportStatCards variant="icon" columns={3} items={cards} />
      <div className="report-status-filter">
        <Segmented
          className="report-segmented"
          value={status}
          options={segmentedOptions}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
      </div>
      <ReportTableCard<SalesEntryDto>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={loading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        countUnit={t("Report:Unit:Voucher")}
      />
    </>
  );
}
