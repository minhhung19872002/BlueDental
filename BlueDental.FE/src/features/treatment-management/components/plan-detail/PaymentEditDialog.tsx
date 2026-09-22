import { useEffect } from "react";
import { DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { FloatingField } from "@/components/FloatingField";
import {
  PAYMENT_ACCOUNT_KIND,
  usePaymentAccountOptions,
  type PaymentAccountKindCode,
} from "@/hooks/usePaymentAccountOptions";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  PAYMENT_METHOD,
  PAYMENT_METHOD_ORDER,
  paymentMethodLabels,
  useUpdatePayment,
  type PatientPaymentDto,
  type PaymentMethodKind,
} from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";

/** Ngân hàng and Ví momo collect into one of the clinic's accounts; the rest do not. */
const ACCOUNT_KIND_BY_METHOD: Partial<Record<PaymentMethodKind, PaymentAccountKindCode>> = {
  [PAYMENT_METHOD.Banking]: PAYMENT_ACCOUNT_KIND.Bank,
  [PAYMENT_METHOD.EWallet]: PAYMENT_ACCOUNT_KIND.MoMo,
};

interface EditValues {
  method: PaymentMethodKind;
  paymentAccountId?: string;
  paidAt: Dayjs;
  note?: string;
}

interface Props {
  payment: PatientPaymentDto | null;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * "Chỉnh sửa" on a receipt row.
 *
 * Only how the money was taken can be corrected here — the channel, the account
 * behind it, the date and the note. The amount and the per-service split are
 * read-only: the slip's rollup and every line's "Còn nợ" are derived from them,
 * so a wrong amount is voided with "Huỷ" and collected again.
 */
export function PaymentEditDialog({ payment, branchId, onClose, onSaved }: Props) {
  const [form] = Form.useForm<EditValues>();
  const update = useUpdatePayment();
  const method = Form.useWatch("method", form) ?? PAYMENT_METHOD.Cash;
  const accountKind = ACCOUNT_KIND_BY_METHOD[method] ?? null;
  const accounts = usePaymentAccountOptions(branchId, accountKind).data ?? [];
  const labels = paymentMethodLabels();

  useEffect(() => {
    if (!payment) return;
    form.setFieldsValue({
      method: payment.method,
      paymentAccountId: payment.paymentAccountId ?? undefined,
      paidAt: dayjs(payment.paidAt),
      note: payment.note ?? undefined,
    });
  }, [payment, form]);

  const handleSave = async () => {
    if (!payment) return;
    const values = await form.validateFields();
    try {
      await update.mutateAsync({
        id: payment.id,
        method: values.method,
        paymentAccountId: accountKind ? (values.paymentAccountId ?? null) : null,
        paidAt: values.paidAt.toISOString(),
        note: values.note?.trim() || null,
      });
      toast.success(t("Đã cập nhật phiếu thanh toán"));
      onSaved();
    } catch (error) {
      notifyError(extractApiError(error) || t("Không thể cập nhật phiếu thanh toán"));
    }
  };

  return (
    <Modal
      open={payment !== null}
      onCancel={onClose}
      width="min(560px, calc(100vw - 32px))"
      className="tp-dialog"
      title={t("Chỉnh sửa phiếu thanh toán")}
      closeIcon={<X size={20} aria-hidden="true" />}
      destroyOnHidden
      footer={
        <div className="tp-create-foot">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            disabled={update.isPending}
            onClick={() => void handleSave()}
          >
            <Save size={16} aria-hidden="true" />
            {t("Lưu")}
          </button>
        </div>
      }
    >
      {payment && (
        <Form<EditValues> form={form} layout="vertical" className="tp-create-body">
          {/* What cannot be corrected here, stated rather than shown as a dead field. */}
          <div className="pdt-edit-facts">
            <p>
              <span>{t("Mã thanh toán:")}</span> <b>{payment.code}</b>
            </p>
            <p>
              <span>{t("Số tiền:")}</span> <b>{moneyText(payment.amount)}</b>
            </p>
          </div>

          <div className="tp-create-grid">
            <FloatingField
              name="method"
              label={t("Hình thức")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn hình thức") }]}
            >
              <Select
                options={PAYMENT_METHOD_ORDER.map((value) => ({ value, label: labels[value] }))}
                onChange={() => form.setFieldValue("paymentAccountId", undefined)}
              />
            </FloatingField>
            <FloatingField
              name="paidAt"
              label={t("Ngày tạo")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn ngày") }]}
            >
              <DatePicker showTime format="DD/MM/YYYY HH:mm" className="tp-input-full" />
            </FloatingField>
          </div>

          {accountKind !== null && (
            <FloatingField
              name="paymentAccountId"
              label={t("Tài khoản nhận tiền")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn tài khoản thanh toán") }]}
            >
              <Select
                options={accounts.map((account) => ({
                  value: account.id,
                  label: account.bankName
                    ? `${account.bankName} — ${account.accountNumber ?? ""}`
                    : `${account.holderName} — ${account.phoneNumber ?? ""}`,
                }))}
              />
            </FloatingField>
          )}

          <FloatingField
            name="note"
            label={t("Ghi chú")}
            className="tp-create-note"
            rules={[{ max: 500, message: t("Nội dung ghi chú vượt quá 500 ký tự.") }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </FloatingField>
        </Form>
      )}
    </Modal>
  );
}
