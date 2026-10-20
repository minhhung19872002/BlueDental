import { useState } from "react";
import { Button, type TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import {
  invoiceStatusConfig,
  usePatientInvoices,
  type InvoiceDto,
  type InvoiceStatus,
} from "@/features/billing/api";
import { PaymentModal } from "@/features/billing/components/PaymentModal";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate, formatMoneyUnit } from "@/utils/format";

/** The payments the patient owes and has made — the Hóa đơn tab before Yêu cầu xuất HĐ. */
export function PatientReceiptTable({ patientId }: { patientId: string }) {
  const ability = useAbility("payment");
  const query = usePatientInvoices(patientId);
  const [selected, setSelected] = useState<InvoiceDto | null>(null);
  const pagination = useTablePagination(20);
  const rows = query.data ?? [];
  const columns: TableColumnsType<InvoiceDto> = [
    { title: t("Patient:Payment:InvoiceCode"), dataIndex: "invoiceNumber", width: 136 },
    { title: t("Patient:Col:CreatedAt"), dataIndex: "issuedAt", width: 96, render: formatDate },
    {
      title: t("Patient:Payment:TotalAmount"),
      dataIndex: "totalAmount",
      width: 112,
      align: "right",
      render: (value: number) => formatMoneyUnit(value),
    },
    {
      title: t("Patient:Payment:Paid"),
      dataIndex: "paidAmount",
      width: 116,
      align: "right",
      render: (value: number) => formatMoneyUnit(value),
    },
    {
      title: t("Patient:Payment:Remaining"),
      dataIndex: "balanceDue",
      width: 112,
      align: "right",
      render: (value: number) => formatMoneyUnit(value),
    },
    {
      title: t("Patient:Misc:StatusLabel"),
      dataIndex: "status",
      width: 112,
      render: (value: InvoiceStatus) => {
        const config = invoiceStatusConfig()[value];
        return <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>;
      },
    },
    ...(ability.canCreate ? [{
      title: t("Common:Actions"),
      width: 110,
      fixed: "right" as const,
      render: (_: unknown, row: InvoiceDto) => (
        <Button type="link" disabled={row.balanceDue <= 0} onClick={() => setSelected(row)}>
          {t("Patient:Payment:Collect")}
        </Button>
      ),
    }] : []),
  ];
  return (
    <>
      <div className="bd-cat-card">
        <DataTable<InvoiceDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Patient:Payment:NoInvoice") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("Patient:Misc:Invoice")))}
        />
      </div>
      <PaymentModal open={Boolean(selected)} invoice={selected} onClose={() => setSelected(null)} />
    </>
  );
}
