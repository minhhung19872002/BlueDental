import { Typography, type TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import {
  paymentKindConfig,
  usePatientAccount,
  type PatientPaymentDto,
  type PatientPaymentKind,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime, formatVND } from "@/utils/format";

const { Text } = Typography;

export function PatientDebtTab({ patientId }: { patientId: string }) {
  const branchId = useCurrentBranchId();
  const query = usePatientAccount(patientId, branchId);
  const pagination = useTablePagination(20);
  const rows = query.data?.payments ?? [];
  const columns: TableColumnsType<PatientPaymentDto> = [
    { title: t("Ngày giao dịch"), dataIndex: "paidAt", width: 180, render: formatDateTime },
    {
      title: t("Loại"),
      dataIndex: "kind",
      width: 160,
      render: (value: PatientPaymentKind) => paymentKindConfig()[value].label,
    },
    {
      title: t("Số tiền"),
      dataIndex: "amount",
      width: 180,
      render: (value: number) => <Text strong>{formatVND(value)} đ</Text>,
    },
    {
      title: t("Nhân viên"),
      dataIndex: "staffName",
      width: 200,
      render: (value: string | null) => value ?? "—",
    },
    { title: t("Ghi chú"), dataIndex: "note", render: (value: string | null) => value ?? "—" },
  ];
  return (
    <section className="pd-pane pd-pane--fill">
      <div className="bd-cat-card">
        <DataTable<PatientPaymentDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Chưa có lịch sử dư nợ") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("giao dịch")))}
        />
      </div>
    </section>
  );
}
