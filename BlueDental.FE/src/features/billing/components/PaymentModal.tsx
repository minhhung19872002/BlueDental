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
      toast.success(t("Đã ghi nhận thanh toán"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const methodLabels = paymentMethodLabels();

  return (
    <Modal
      open={open}
      title={t("Ghi nhận thanh toán")}
      okText={t("Xác nhận thanh toán")}
      cancelText={t("Huỷ")}
      confirmLoading={recordPayment.isPending}
      onOk={() => void handleOk()}
      onCancel={onClose}
      destroyOnHidden
      width={430}
      className="pay-modal"
      /* Money coming in is green in the design, not the navy primary. */
      okButtonProps={{ className: "btn-confirm-money" }}
    >
      {invoice && (
        <div className="pay-summary">
          <div className="pay-summary-row">
            <span>{t("Phiếu")}</span>
            <strong>{invoice.invoiceNumber}</strong>
          </div>
          <div className="pay-summary-row">
            <span>{t("Khách hàng")}</span>
            <strong>{invoice.patientName || "—"}</strong>
          </div>
          <div className="pay-summary-row">
            <span>{t("Còn lại")}</span>
            <strong className="pay-summary-due">{formatVND(outstanding)}</strong>
          </div>
        </div>
      )}

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="amount"
          label={t("Số tiền")}
          rules={[
            { required: true, message: t("Vui lòng nhập số tiền") },
            {
              type: "number",
              min: 1,
              message: t("Số tiền phải lớn hơn 0"),
            },
            {
              type: "number",
              max: outstanding,
              message: t("Không thu quá số còn lại"),
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
          label={t("Phương thức thanh toán")}
          rules={[{ required: true, message: t("Vui lòng chọn phương thức") }]}
        >
          <Select
            options={Object.entries(methodLabels).map(([value, label]) => ({
              value: Number(value) as PaymentMethod,
              label,
            }))}
          />
        </Form.Item>

        <Form.Item name="reference" label={t("Mã tham chiếu")}>
          <Input placeholder={t("Số giao dịch, mã chuyển khoản...")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
