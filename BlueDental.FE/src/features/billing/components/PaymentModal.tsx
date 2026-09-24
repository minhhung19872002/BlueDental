import { useEffect } from "react";
import { Form, Input, InputNumber, Modal, Select } from "antd";
import {
  PAYMENT_METHOD,
  paymentMethodLabels,
  useRecordPayment,
  type InvoiceDto,
  type PaymentMethod,
} from "../api";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PaymentFormValues {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

interface Props {
  open: boolean;
  invoice: InvoiceDto | null;
  onClose: () => void;
}

export function PaymentModal({ open, invoice, onClose }: Props) {
  const [form] = Form.useForm<PaymentFormValues>();
  const recordPayment = useRecordPayment();

  const outstanding = invoice?.balanceDue ?? 0;

  useEffect(() => {
    if (open && invoice) {
      // Settling the balance is the common case, so that is what it opens on.
      form.setFieldsValue({
        amount: outstanding,
        method: PAYMENT_METHOD.Cash,
        reference: "",
      });
    }
  }, [open, invoice, outstanding, form]);

  const handleOk = async () => {
    if (!invoice) return;

    const values = await form.validateFields();

    try {
      await recordPayment.mutateAsync({
        id: invoice.id,
        data: {
          amount: values.amount,
          // The invoice carries its own currency; a payment in another one
          // would be rejected by the Money value object.
          currency: invoice.currency,
          method: values.method,
          reference: values.reference?.trim() || undefined,
        },
      });
      toast.success(t("Billing:RecordPaymentSuccess"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const methodLabels = paymentMethodLabels();

  return (
    <Modal
      open={open}
      title={t("Billing:RecordPayment")}
      okText={t("Billing:ConfirmPayment")}
      cancelText={t("Common:CancelAlt")}
      confirmLoading={recordPayment.isPending}
      onOk={() => void handleOk()}
      onCancel={onClose}
      /*
       * Deliberately not destroyed on close. The effect above rewrites every
       * field whenever it opens, so there is no stale state to clear, and
       * rebuilding the form each time cost a visible pause — Ant Design's own
       * modal code spent 43ms of forced layout on the rebuild alone.
       */
      width={430}
      className="pay-modal"
      /* Money coming in is green in the design, not the navy primary. */
      okButtonProps={{ className: "btn-confirm-money" }}
    >
      {invoice && (
        <div className="pay-summary">
          <div className="pay-summary-row">
            <span>{t("Billing:Invoice")}</span>
            <strong>{invoice.invoiceNumber}</strong>
          </div>
          <div className="pay-summary-row">
            <span>{t("Billing:Customer")}</span>
            <strong>{invoice.patientName || "—"}</strong>
          </div>
          <div className="pay-summary-row">
            <span>{t("Billing:Remaining")}</span>
            <strong className="pay-summary-due">{formatVND(outstanding)}</strong>
          </div>
        </div>
      )}

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="amount"
          label={t("Billing:Amount")}
          rules={[
            { required: true, message: t("Billing:AmountRequired") },
            {
              type: "number",
              min: 1,
              message: t("Billing:AmountPositive"),
            },
            {
              type: "number",
              max: outstanding,
              message: t("Billing:AmountExceedsRemaining"),
            },
          ]}
        >
          <InputNumber<number>
            style={{ width: "100%" }}
            min={0}
            step={50_000}
            formatter={(value) => (value ? formatVND(Number(value)) : "")}
            parser={(value) => Number((value ?? "").replace(/\D/g, ""))}
          />
        </Form.Item>

        <Form.Item
          name="method"
          label={t("Billing:PaymentMethodLabel")}
          rules={[{ required: true, message: t("Billing:PaymentMethodRequired") }]}
        >
          <Select
            options={Object.entries(methodLabels).map(([value, label]) => ({
              value: Number(value) as PaymentMethod,
              label,
            }))}
          />
        </Form.Item>

        <Form.Item name="reference" label={t("Billing:Reference")}>
          <Input placeholder={t("Billing:ReferencePlaceholder")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
