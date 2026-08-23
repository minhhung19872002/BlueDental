import { useEffect } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Typography,
} from "antd";
import { useTranslation } from "react-i18next";
import { useInvoice, useRecordPayment, type RecordPaymentRequest } from "../api";

const { Text } = Typography;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
}

interface FormValues {
  amount: number;
  paymentMethod: string;
  note?: string;
}

export function PaymentModal({ open, onClose, invoiceId }: Props) {
  const { t } = useTranslation();
  const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "Cash",     label: t("billing.paymentCash") },
    { value: "Transfer", label: t("billing.paymentTransfer") },
    { value: "Card",     label: t("billing.paymentCard") },
  ];
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { mutate: recordPayment, isPending } = useRecordPayment();

  const balance = invoice ? invoice.totalAmount - invoice.paidAmount : 0;

  // Pre-fill amount with remaining balance whenever modal opens or invoice changes
  useEffect(() => {
    if (open && balance > 0) {
      form.setFieldValue("amount", balance);
    }
  }, [open, balance, form]);

  function handleClose(): void {
    form.resetFields();
    onClose();
  }

  function handleSubmit(values: FormValues): void {
    const payload: RecordPaymentRequest = {
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      note: values.note,
    };
    recordPayment(
      { id: invoiceId, data: payload },
      {
        onSuccess: () => {
          messageApi.success(t("billing.paymentSuccess"));
          handleClose();
        },
        onError: () => {
          messageApi.error(t("billing.paymentFailed"));
        },
      }
    );
  }

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title={t("billing.recordPayment")}
        onCancel={handleClose}
        footer={null}
        destroyOnClose
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <>
            {invoice && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">{t("billing.remainingBalance")}: </Text>
                <Text strong type={balance > 0 ? "danger" : "success"}>
                  {formatCurrency(balance)}
                </Text>
              </div>
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ paymentMethod: "Cash" }}
            >
              <Form.Item
                name="amount"
                label={t("billing.paymentAmount")}
                rules={[
                  { required: true, message: t("payment.validation.amountRequired") },
                  {
                    type: "number",
                    min: 1,
                    message: t("payment.validation.amountPositive"),
                  },
                  {
                    validator: (_, value: number) => {
                      if (value > balance) {
                        return Promise.reject(
                          new Error(t("payment.validation.amountExceedsBalance"))
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  step={1000}
                  formatter={(val) =>
                    val ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                  }
                  parser={(val) => Number((val ?? "").replace(/,/g, ""))}
                  addonAfter="₫"
                />
              </Form.Item>

              <Form.Item
                name="paymentMethod"
                label={t("billing.paymentMethod")}
                rules={[{ required: true, message: t("payment.validation.methodRequired") }]}
              >
                <Select options={PAYMENT_METHODS} />
              </Form.Item>

              <Form.Item name="note" label={t("billing.noteOptional")}>
                <Input.TextArea rows={3} placeholder={t("billing.notePlaceholder")} />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                <Button style={{ marginRight: 8 }} onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="primary" htmlType="submit" loading={isPending}>
                  {t("billing.confirmPayment")}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
}
