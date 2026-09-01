import { useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  PAYMENT_KIND,
  paymentKindConfig,
  PAYMENT_METHOD,
  paymentMethodLabels,
  usePatientAccount,
  useRecordPayment,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime, formatVND } from "@/utils/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";

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
    { label: t("Tổng phiếu"), value: account?.payment.totalPrice ?? 0, testId: "acc-total", color: "#171c33" },
    { label: t("Đã thanh toán"), value: account?.payment.totalPaid ?? 0, testId: "acc-paid", color: "#0e9f6e" },
    { label: t("Hoàn tiền"), value: account?.payment.totalRefund ?? 0, testId: "acc-refund", color: "#d98b0f" },
    { label: t("Còn lại"), value: account?.payment.totalDue ?? 0, testId: "acc-due", color: "#e5484d" },
    { label: t("Phải thu"), value: account?.payment.debt ?? 0, testId: "acc-debt", color: "#e5484d" },
    { label: t("Đang giữ hộ"), value: account?.heldForPatient ?? 0, testId: "acc-held", color: "#6366f1" },
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

      toast.success(t("Đã ghi nhận giao dịch"));
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const columns: TableColumnsType<PatientPaymentDto> = [
    {
      title: t("Ngày"),
      dataIndex: "paidAt",
      key: "paidAt",
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    { title: t("Số phiếu"), dataIndex: "code", key: "code", width: 120 },
    {
      title: t("Loại"),
      dataIndex: "kind",
      key: "kind",
      width: 110,
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
        <Text style={{ color: row.kind === PAYMENT_KIND.Refund ? "#e5484d" : "#0e9f6e" }}>
          {row.kind === PAYMENT_KIND.Refund ? "-" : ""}
          {formatVND(value)} {t("đ")}
        </Text>
      ),
    },
    {
      title: t("Người thu"),
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
          {t("Ghi nhận thanh toán")}
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {tiles.map((tile) => (
          <Col key={tile.testId} xs={12} md={8} lg={4}>
            <Card size="small" data-testid={tile.testId}>
              <div style={{ fontSize: 12, color: "#99a0bd" }}>{tile.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tile.color }}>
                {formatVND(tile.value)} {t("đ")}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title={t("Lịch sử giao dịch")}>
        <Table<PatientPaymentDto>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={account?.payments ?? []}
          pagination={false}
          locale={{ emptyText: <span style={{ color: "#99a0bd" }}>{t("Chưa có giao dịch")}</span> }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={t("Ghi nhận thanh toán")}
        okText={t("Lưu")}
        cancelText={t("Huỷ")}
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
          <Form.Item name="kind" label={t("Loại giao dịch")} rules={[{ required: true }]}>
            <Select
              options={Object.entries(paymentKindConfig()).map(([value, config]) => ({
                value: Number(value),
                label: config.label,
              }))}
            />
          </Form.Item>

          {kind !== PAYMENT_KIND.Prepaid && (
            <Form.Item
              name="treatmentPlanId"
              label={t("Kế hoạch điều trị")}
              rules={[{ required: true, message: t("Vui lòng chọn kế hoạch") }]}
            >
              <Select
                placeholder={
                  slips.length === 0 ? t("Bệnh nhân chưa có kế hoạch điều trị") : t("Chọn kế hoạch")
                }
                options={slips.map((slip) => ({
                  value: slip.id,
                  label: t("{0} — còn lại {1} đ", slip.code, formatVND(slip.payment.totalDue)),
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="method" label={t("Hình thức")} rules={[{ required: true }]}>
            <Select
              options={Object.entries(paymentMethodLabels()).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="amount"
            label={t("Số tiền (đ)")}
            rules={[
              { required: true, message: t("Vui lòng nhập số tiền") },
              { type: "number", min: 1, message: t("Số tiền phải lớn hơn 0") },
            ]}
          >
            <CurrencyInput />
          </Form.Item>

          <Form.Item
            name="staffId"
            label={t("Người thu")}
            rules={[{ required: true, message: t("Vui lòng chọn người thu") }]}
          >
            <Select
              placeholder={t("Chọn nhân viên")}
              options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
