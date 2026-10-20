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
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
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
  const { data: allStaff } = useStaffOptions();
  const recordPayment = useRecordPayment();

  const kind = Form.useWatch("kind", form) ?? PAYMENT_KIND.Payment;
  const slips = account?.plans ?? [];

  const tiles = [
    { label: t("Treatment:Payment:TotalSlip"), value: account?.payment.totalPrice ?? 0, testId: "acc-total", color: "#171c33" },
    { label: t("Treatment:Receipt:TotalPaid"), value: account?.payment.totalPaid ?? 0, testId: "acc-paid", color: "#0e9f6e" },
    { label: t("Treatment:Refund:Refund"), value: account?.payment.totalRefund ?? 0, testId: "acc-refund", color: "#d98b0f" },
    { label: t("Treatment:Debt:Remaining"), value: account?.payment.debt ?? 0, testId: "acc-due", color: "#e5484d" },
    {
      label: t("Treatment:Payment:MustCollect"),
      value: Math.max(0, account?.payment.receivable ?? 0),
      testId: "acc-debt",
      color: "#e5484d",
    },
    { label: t("Treatment:Payment:Holding"), value: account?.heldForPatient ?? 0, testId: "acc-held", color: "#6366f1" },
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

      toast.success(t("Treatment:Payment:TransactionRecorded"));
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const columns: TableColumnsType<PatientPaymentDto> = [
    {
      title: t("Treatment:Receipt:DateLabel"),
      dataIndex: "paidAt",
      key: "paidAt",
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    { title: t("Treatment:Payment:SlipNumber"), dataIndex: "code", key: "code", width: 120 },
    {
      title: t("Treatment:Payment:Kind"),
      dataIndex: "kind",
      key: "kind",
      width: 110,
      render: (value: PatientPaymentKind) => {
        const config = paymentKindConfig()[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t("Treatment:Payment:Form"),
      dataIndex: "method",
      key: "method",
      width: 130,
      render: (value: PaymentMethodKind) => paymentMethodLabels()[value],
    },
    {
      title: t("Treatment:Plan:Plan"),
      dataIndex: "treatmentPlanCode",
      key: "treatmentPlanCode",
      width: 100,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Treatment:Pricing:Amount"),
      dataIndex: "amount",
      key: "amount",
      width: 140,
      align: "right",
      render: (value: number, row) => (
        <Text style={{ color: row.kind === PAYMENT_KIND.Refund ? "#e5484d" : "#0e9f6e" }}>
          {row.kind === PAYMENT_KIND.Refund ? "-" : ""}
          {formatVND(value)} {t("Treatment:Pricing:CurrencyUnit")}
        </Text>
      ),
    },
    {
      title: t("Treatment:Payment:Collector"),
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
          {t("Treatment:Payment:RecordPayment")}
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {tiles.map((tile) => (
          <Col key={tile.testId} xs={12} md={8} lg={4}>
            <Card size="small" data-testid={tile.testId}>
              <div style={{ fontSize: 12, color: "#99a0bd" }}>{tile.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tile.color }}>
                {formatVND(tile.value)} {t("Treatment:Pricing:CurrencyUnit")}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title={t("Treatment:Debt:TransactionHistory")}>
        <Table<PatientPaymentDto>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={account?.payments ?? []}
          pagination={false}
          locale={{ emptyText: <span style={{ color: "#99a0bd" }}>{t("Treatment:Debt:NoTransactions")}</span> }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={t("Treatment:Payment:RecordPayment")}
        okText={t("Common:Save")}
        cancelText={t("Common:Cancel")}
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
          <Form.Item name="kind" label={t("Treatment:Payment:TransactionType")} rules={[{ required: true }]}>
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
              label={t("Treatment:Plan:TreatmentPlan")}
              rules={[{ required: true, message: t("Treatment:Plan:PlanRequired") }]}
            >
              <Select
                placeholder={
                  slips.length === 0 ? t("Treatment:Plan:NoPlan") : t("Treatment:Plan:SelectPlan")
                }
                options={slips.map((slip) => ({
                  value: slip.id,
                  label: t("Treatment:Slip:Remaining", slip.code, formatVND(slip.payment.debt)),
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="method" label={t("Treatment:Payment:Form")} rules={[{ required: true }]}>
            <Select
              options={Object.entries(paymentMethodLabels()).map(([value, label]) => ({
                value: Number(value),
                label,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="amount"
            label={t("Treatment:Pricing:AmountVnd")}
            rules={[
              { required: true, message: t("Treatment:Pricing:AmountRequired") },
              { type: "number", min: 1, message: t("Treatment:Pricing:AmountMin") },
            ]}
          >
            <CurrencyInput />
          </Form.Item>

          <Form.Item
            name="staffId"
            label={t("Treatment:Payment:Collector")}
            rules={[{ required: true, message: t("Treatment:Payment:CollectorRequired") }]}
          >
            <Select
              placeholder={t("Treatment:Common:SelectStaff")}
              options={allStaff ?? []}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
