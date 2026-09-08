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
import { PrescriptionPanel } from "@/features/treatment-management/components/PrescriptionPanel";
import type { PrescriptionPatientSummary } from "@/features/treatment-management/types/prescription";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate, formatVND } from "@/utils/format";
import { GENDER, type GenderCode, type PatientDto } from "../../types/patient";

const GENDER_LABELS: Record<GenderCode, string> = {
  [GENDER.Male]: "Nam",
  [GENDER.Female]: "Nữ",
  [GENDER.Other]: "Khác",
  [GENDER.PreferNotToSay]: "Không tiết lộ",
};

export function PatientPrescriptionTab({ patient }: { patient: PatientDto }) {
  const summary: PrescriptionPatientSummary = {
    id: patient.id,
    code: patient.patientCode,
    fullName: patient.fullName,
    genderLabel: t(GENDER_LABELS[patient.gender]),
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: patient.phoneNumber,
    diseaseHistoryEntryIds: patient.diseaseHistoryEntryIds,
  };
  return (
    <section className="pd-pane pd-pane--fill">
      <PrescriptionPanel patient={summary} />
    </section>
  );
}

export function PatientInvoiceTab({ patientId }: { patientId: string }) {
  const query = usePatientInvoices(patientId);
  const [selected, setSelected] = useState<InvoiceDto | null>(null);
  const pagination = useTablePagination(20);
  const rows = query.data ?? [];
  const columns: TableColumnsType<InvoiceDto> = [
    { title: t("Mã hóa đơn"), dataIndex: "invoiceNumber", width: 140 },
    { title: t("Ngày tạo"), dataIndex: "issuedAt", width: 125, render: formatDate },
    {
      title: t("Tổng tiền"),
      dataIndex: "totalAmount",
      width: 135,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Đã thanh toán"),
      dataIndex: "paidAmount",
      width: 145,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Còn lại"),
      dataIndex: "balanceDue",
      width: 135,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      width: 140,
      render: (value: InvoiceStatus) => {
        const config = invoiceStatusConfig()[value];
        return <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>;
      },
    },
    {
      title: t("Thao tác"),
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Button type="link" disabled={row.balanceDue <= 0} onClick={() => setSelected(row)}>
          {t("Thu tiền")}
        </Button>
      ),
    },
  ];
  return (
    <section className="pd-pane pd-pane--fill">
      <div className="bd-cat-card">
        <DataTable<InvoiceDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Chưa có hóa đơn") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("hóa đơn")))}
        />
      </div>
      <PaymentModal open={Boolean(selected)} invoice={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
