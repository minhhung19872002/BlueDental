import { Card, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  PAYMENT_KIND,
  PAYMENT_KIND_CONFIG,
  PAYMENT_METHOD_LABELS,
  usePatientAccount,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDateTime, formatVND } from "@/utils/format";

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
      title: "Ngày giao dịch",
      dataIndex: "paidAt",
      key: "paidAt",
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "Loại",
      dataIndex: "kind",
      key: "kind",
      width: 120,
      render: (value: PatientPaymentKind) => {
        const config = PAYMENT_KIND_CONFIG[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Hình thức",
      dataIndex: "method",
      key: "method",
      width: 130,
      render: (value: PaymentMethodKind) => PAYMENT_METHOD_LABELS[value],
    },
    {
      title: "Kế hoạch",
      dataIndex: "treatmentPlanCode",
      key: "treatmentPlanCode",
      width: 100,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      width: 140,
      align: "right",
      render: (value: number, row) => (
        <Text style={{ color: row.kind === PAYMENT_KIND.Refund ? "#EF4444" : "#10B981" }}>
          {row.kind === PAYMENT_KIND.Refund ? "-" : "+"}
          {formatVND(value)} đ
        </Text>
      ),
    },
    {
      title: "Luỹ kế đã thu",
      dataIndex: "runningCollected",
      key: "runningCollected",
      width: 150,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: "Nhân viên",
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
          Phải thu hiện tại: <strong>{formatVND(account?.payment.debt ?? 0)} đ</strong> · Còn lại
          trên phiếu: <strong>{formatVND(account?.payment.totalDue ?? 0)} đ</strong>
        </Text>
      </div>

      <Table<DebtRow>
        size="small"
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị ${rows.length} trên ${total} giao dịch` }}
        locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có lịch sử dư nợ</span> }}
      />
    </Card>
  );
}
