import { Card, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  PAYMENT_KIND,
  paymentKindConfig,
  paymentMethodLabels,
  usePatientAccount,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDateTime, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

const { Text } = Typography;

interface PatientDebtHistoryPanelProps {
  patientId: string;
}

interface DebtRow extends PatientPaymentDto {
  runningCollected: number;
}

/**
 * Lịch sử dư nợ.
 *
 * The reference never exposed a debt ledger of its own, so this reads the same
 * money movements as the invoice tab and shows the running total collected next to
 * them. The arithmetic is a cumulative sum of server values — no balance is invented.
 */
export function PatientDebtHistoryPanel({ patientId }: PatientDebtHistoryPanelProps) {
  const branchId = useCurrentBranchId();
  const { data: account, isLoading } = usePatientAccount(patientId, branchId);

  // The list arrives newest first; the running total has to accumulate oldest first.
  const oldestFirst = [...(account?.payments ?? [])].reverse();
  let running = 0;
  const rowsOldestFirst: DebtRow[] = oldestFirst.map((payment) => {
    running += payment.kind === PAYMENT_KIND.Refund ? -payment.amount : payment.amount;
    return { ...payment, runningCollected: running };
  });
  const rows = rowsOldestFirst.reverse();

  const columns: TableColumnsType<DebtRow> = [
    {
      title: t("Ngày giao dịch"),
      dataIndex: "paidAt",
      key: "paidAt",
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t("Loại"),
      dataIndex: "kind",
      key: "kind",
      width: 120,
      render: (value: PatientPaymentKind) => {
        const config = paymentKindConfig()[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t("Hình thức"),
      dataIndex: "method",
      key: "method",
      width: 130,
      render: (value: PaymentMethodKind) => paymentMethodLabels()[value],
    },
    {
      title: t("Kế hoạch"),
      dataIndex: "treatmentPlanCode",
      key: "treatmentPlanCode",
      width: 100,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Số tiền"),
      dataIndex: "amount",
      key: "amount",
      width: 140,
      align: "right",
      render: (value: number, row) => (
        <Text style={{ color: row.kind === PAYMENT_KIND.Refund ? "#ef4d4d" : "#1f8a63" }}>
          {row.kind === PAYMENT_KIND.Refund ? "-" : "+"}
          {formatVND(value)} {t("đ")}
        </Text>
      ),
    },
    {
      title: t("Luỹ kế đã thu"),
      dataIndex: "runningCollected",
      key: "runningCollected",
      width: 150,
      align: "right",
      render: (value: number) => t("{0} đ", formatVND(value)),
    },
    {
      title: t("Nhân viên"),
      dataIndex: "staffName",
      key: "staffName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
  ];

  return (
    <Card size="small">
      <div style={{ marginBottom: 12 }} data-testid="debt-summary">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t("Phải thu hiện tại:")} <strong>{formatVND(account?.payment.debt ?? 0)} {t("đ")}</strong> {t("· Còn lại trên phiếu:")} <strong>{formatVND(account?.payment.totalDue ?? 0)} {t("đ")}</strong>
        </Text>
      </div>

      <Table<DebtRow>
        size="small"
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị {0} trên {1} giao dịch", rows.length, total) }}
        locale={{ emptyText: <span style={{ color: "#98a4b4" }}>{t("Chưa có lịch sử dư nợ")}</span> }}
      />
    </Card>
  );
}
