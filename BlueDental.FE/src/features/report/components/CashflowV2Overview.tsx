import { useCallback, useMemo, useState } from "react";
import { Button, Space, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { cashTransactionLabels, formatCashMovement } from "../api/financeApi";
import { notifyDemoAction, useMockCashBalance, useMockCashflowEntries } from "../api/reportMockQueries";
import { useClientPaging } from "../hooks/useClientPaging";
import type { CashflowEntryVm } from "../types/mock";
import { BalancePanels } from "./BalancePanels";
import { ReportTableCard } from "./ReportTableCard";

interface Props {
  onEdit: (entry: CashflowEntryVm) => void;
}

function buildColumns(onEdit: Props["onEdit"], onDelete: (entry: CashflowEntryVm) => void): TableColumnsType<CashflowEntryVm> {
  const types = cashTransactionLabels();
  return [
    { title: t("Ngày"), dataIndex: "entryDate", width: 110, render: (v: string) => formatDate(v) },
    { title: t("Loại giao dịch"), dataIndex: "transactionType", width: 130, render: (v: CashflowEntryVm["transactionType"]) => types[v] },
    {
      title: t("Hình thức"),
      key: "holding",
      width: 220,
      render: (_: unknown, row) => formatCashMovement(row.fromHolding, row.toHolding),
    },
    { title: t("Danh mục"), dataIndex: "categoryName", width: 150, render: (v: string | null) => v ?? "—" },
    {
      title: t("Số tiền"),
      dataIndex: "amount",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money report-money--bold">{formatVND(v)} đ</span>,
    },
    { title: t("Người tạo"), dataIndex: "createdByName", width: 170 },
    { title: t("Ghi chú"), dataIndex: "note", render: (v: string | null) => v ?? "—" },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 100,
      align: "center",
      render: (_: unknown, row) => (
        <Space size={4}>
          <Tooltip title={t("Chỉnh sửa")}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(row)} />
          </Tooltip>
          <Tooltip title={t("Xóa")}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ];
}

/** "Tổng quan" of tab 4: balance panels, service revenue line, transaction table. */
export function CashflowV2Overview({ onEdit }: Props) {
  const { data: balance } = useMockCashBalance();
  const { data: entries = [], isLoading } = useMockCashflowEntries();
  const [deleting, setDeleting] = useState<CashflowEntryVm | null>(null);
  const paging = useClientPaging(entries);

  const closeDelete = useCallback(() => setDeleting(null), []);
  const handleDelete = useCallback(() => {
    if (deleting) notifyDemoAction(t("Xóa giao dịch ngày {0}", formatDate(deleting.entryDate)));
    setDeleting(null);
  }, [deleting]);

  const columns = useMemo(() => buildColumns(onEdit, setDeleting), [onEdit]);

  return (
    <>
      <BalancePanels balance={balance} />
      <div className="report-service-revenue">
        <span>{t("Doanh thu dịch vụ")}</span>
        <span className="report-money report-money--green">{formatVND(balance?.serviceRevenue ?? 0)} đ</span>
      </div>
      <ReportTableCard<CashflowEntryVm>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={isLoading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("giao dịch")}
        name={deleting ? `${formatVND(deleting.amount)} đ` : ""}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
