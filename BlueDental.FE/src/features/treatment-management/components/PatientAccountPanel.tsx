import { useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  PAYMENT_KIND,
  PAYMENT_KIND_CONFIG,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  usePatientAccount,
  useRecordPayment,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime, formatVND } from "@/utils/format";

const { Text } = Typography;

interface PatientAccountPanelProps {
  patientId: string;
}

interface PaymentFormValues {
  kind: PatientPaymentKind;
  method: PaymentMethodKind;
  treatmentPlanId?: string;
  amount: number;
  staffId: string;
}

/**
 * Hóa đơn / công nợ của bệnh nhân.
 *
 * Mirrors the reference's money rollup: what the slips are worth, what has been
 * collected, what is still owed, and what the clinic is holding for the patient.
 * Every figure comes from the server — nothing is added up in the browser.
 */
export function PatientAccountPanel({ patientId }: PatientAccountPanelProps) {
  const branchId = useCurrentBranchId();
  const [form] = Form.useForm<PaymentFormValues>();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: account, isLoading } = usePatientAccount(patientId, branchId);
  const { data: dentists } = useDentistList();
  const recordPayment = useRecordPayment();

  const kind = Form.useWatch("kind", form) ?? PAYMENT_KIND.Payment;
  const slips = account?.plans ?? [];

  const tiles = [
    { label: "Tổng phiếu", value: account?.payment.totalPrice ?? 0, testId: "acc-total", color: "#1B2A41" },
    { label: "Đã thanh toán", value: account?.payment.totalPaid ?? 0, testId: "acc-paid", color: "#10B981" },
    { label: "Hoàn tiền", value: account?.payment.totalRefund ?? 0, testId: "acc-refund", color: "#F59E0B" },
    { label: "Còn lại", value: account?.payment.totalDue ?? 0, testId: "acc-due", color: "#EF4444" },
    { label: "Phải thu", value: account?.payment.debt ?? 0, testId: "acc-debt", color: "#EF4444" },
    { label: "Đang giữ hộ", value: account?.heldForPatient ?? 0, testId: "acc-held", color: "#2671D8" },
  ];

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      await recordPayment.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentPlanId: values.kind === PAYMENT_KIND.Prepaid ? undefined : values.treatmentPlanId,
        kind: values.kind,
        method: values.method,
        amount: values.amount,
        staffId: values.staffId,
      });

      message.success("Đã ghi nhận giao dịch");
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: TableColumnsType<PatientPaymentDto> = [
    {
      title: "Ngày",
      dataIndex: "paidAt",
      key: "paidAt",
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    { title: "Số phiếu", dataIndex: "code", key: "code", width: 120 },
    {
      title: "Loại",
      dataIndex: "kind",
      key: "kind",
      width: 110,
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
          {row.kind === PAYMENT_KIND.Refund ? "-" : ""}
          {formatVND(value)} đ
        </Text>
      ),
    },
    {
      title: "Người thu",
      dataIndex: "staffName",
      key: "staffName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Ghi nhận thanh toán
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {tiles.map((tile) => (
          <Col key={tile.testId} xs={12} md={8} lg={4}>
            <Card size="small" data-testid={tile.testId}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>{tile.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tile.color }}>
                {formatVND(tile.value)} đ
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="Lịch sử giao dịch">
        <Table<PatientPaymentDto>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={account?.payments ?? []}
          pagination={false}
          locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có giao dịch</span> }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title="Ghi nhận thanh toán"
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={recordPayment.isPending}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ kind: PAYMENT_KIND.Payment, method: PAYMENT_METHOD.Cash, amount: 0 }}
        >
          <Form.Item name="kind" label="Loại giao dịch" rules={[{ required: true }]}>
            <Select
              options={Object.entries(PAYMENT_KIND_CONFIG).map(([value, config]) => ({
                value: Number(value),
                label: config.label,
              }))}
            />
          </Form.Item>

          {kind !== PAYMENT_KIND.Prepaid && (
            <Form.Item
              name="treatmentPlanId"
              label="Kế hoạch điều trị"
              rules={[{ required: true, message: "Vui lòng chọn kế hoạch" }]}
            >
              <Select
                placeholder={
                  slips.length === 0 ? "Bệnh nhân chưa có kế hoạch điều trị" : "Chọn kế hoạch"
                }
                options={slips.map((slip) => ({
                  value: slip.id,
                  label: `${slip.code} — còn lại ${formatVND(slip.payment.totalDue)} đ`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="method" label="Hình thức" rules={[{ required: true }]}>
            <Select
              options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Số tiền (đ)"
            rules={[
              { required: true, message: "Vui lòng nhập số tiền" },
              { type: "number", min: 1, message: "Số tiền phải lớn hơn 0" },
            ]}
          >
            <InputNumber<number>
              style={{ width: "100%" }}
              min={0}
              step={100000}
              formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(v) => Number((v ?? "").replace(/\./g, "")) as 0}
            />
          </Form.Item>

          <Form.Item
            name="staffId"
            label="Người thu"
            rules={[{ required: true, message: "Vui lòng chọn người thu" }]}
          >
            <Select
              placeholder="Chọn nhân viên"
              options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
