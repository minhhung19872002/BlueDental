import { useMemo, useState } from "react";
import { Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useInvoiceReport, type InvoiceReportRow } from "../api/operationReportApi";
import { operationsTotal } from "../operationsTotal";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";
import { formatDate } from "@/utils/format";

/** How the money on an invoice has settled, as the reference names each state. */
const STATUS_LABELS: Record<string, string> = {
  Draft: "Nháp",
  Issued: "Đã phát hành",
  PartiallyPaid: "Thanh toán một phần",
  Paid: "Đã thanh toán",
  Overdue: "Quá hạn",
  Voided: "Đã huỷ",
};

/**
 * Khối tài chính → Hóa đơn.
 */
export function InvoiceReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [status, setStatus] = useState<string | undefined>();

  const query = useInvoiceReport(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    { Status: status },
  );

  const columns = useMemo<ColumnsType<InvoiceReportRow>>(
    () => [
      {
        key: "createdAt",
        title: t("Ngày tạo"),
        width: 130,
        render: (_, row) => <span className="bd-cat-num">{formatDate(row.createdAt)}</span>,
      },
      { key: "number", title: t("Số hóa đơn"), dataIndex: "invoiceNumber", width: 170 },
      { key: "patient", title: t("Tên bệnh nhân"), dataIndex: "patientName", width: 210 },
      { key: "unit", title: t("Tên đơn vị"), dataIndex: "unitName", width: 230 },
      {
        key: "method",
        title: t("Hình thức thanh toán"),
        width: 180,
        render: (_, row) => row.paymentMethod || "—",
      },
      { key: "issue", title: t("Trạng thái hóa đơn"), dataIndex: "issueStatus", width: 180 },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 180,
        render: (_, row) => (
          <span className="bd-ops-tag">{t(STATUS_LABELS[row.status] ?? row.status)}</span>
        ),
      },
      {
        key: "subTotal",
        title: t("Tổng trước VAT"),
        width: 160,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{formatMoney(row.subTotal)}</span>,
      },
      {
        key: "tax",
        title: t("Tổng VAT"),
        width: 140,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{formatMoney(row.taxAmount)}</span>,
      },
      {
        key: "total",
        title: t("Tổng tiền"),
        width: 160,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num bd-semibold">{formatMoney(row.totalAmount)}</span>
        ),
      },
      {
        key: "supplier",
        title: t("Nhà cung cấp"),
        width: 170,
        render: (_, row) => row.supplier ?? "—",
      },
    ],
    [],
  );

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} periods={["day", "week", "month"]} />
      </div>

      <div className="bd-ops-report-filters">
        <Select
          className="bd-ops-filter"
          allowClear
          placeholder={t("Tất cả trạng thái")}
          aria-label={t("Tất cả trạng thái")}
          value={status}
          onChange={(value) => {
            setStatus(value ?? undefined);
            pagination.resetToFirstPage();
          }}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label: t(label),
          }))}
        />
      </div>

      <div className="bd-cat-card">
        <DataTable<InvoiceReportRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey="invoiceNumber"
          loading={query.isFetching}
          scroll={{ x: 2000 }}
          pagination={pagination.buildConfig(query.data?.totalCount ?? 0, operationsTotal)}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
