import { useMemo } from "react";
import { RiseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { SALES_ENTRY_TYPE } from "../api/financeApi";
import { useClientPaging } from "../hooks/useClientPaging";
import type { SalesEntryVm } from "../types/mock";
import { ReportStatCards } from "./ReportStatCards";
import { ReportTableCard } from "./ReportTableCard";
import { buildSalesEntryColumns } from "./cashflowColumns";

interface Props {
  entries: SalesEntryVm[];
  loading: boolean;
  onEdit: (entry: SalesEntryVm) => void;
}

/** "Thu nhập": one card (Tổng doanh thu) + voucher table. */
export function CashflowIncomeView({ entries, loading, onEdit }: Props) {
  const incomeEntries = useMemo(
    () => entries.filter((e) => e.type === SALES_ENTRY_TYPE.Income),
    [entries],
  );
  const total = useMemo(() => incomeEntries.reduce((s, e) => s + e.amount, 0), [incomeEntries]);
  const paging = useClientPaging(incomeEntries);
  const columns = useMemo(() => buildSalesEntryColumns({ kind: "income", onEdit }), [onEdit]);

  return (
    <>
      <ReportStatCards
        variant="icon"
        columns={3}
        items={[{ label: t("Tổng doanh thu"), value: total, tone: "green", icon: <RiseOutlined /> }]}
      />
      <ReportTableCard<SalesEntryVm>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={loading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
      />
    </>
  );
}
