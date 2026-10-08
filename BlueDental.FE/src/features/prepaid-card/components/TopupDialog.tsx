import { Form, Input } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { SALE_METHOD, type CardDto, type SaleMethod, type TopupCardInput } from "../types";
import { MoneyTakenFields } from "./MoneyTakenFields";

interface FormValues {
  value?: number;
  paidAmount?: number;
  method: SaleMethod;
  paymentAccountId?: string;
  note?: string;
}

interface Props {
  card: CardDto | null;
  saving: boolean;
  onSubmit: (input: TopupCardInput) => void;
  onClose: () => void;
}

/**
 * "Nạp thêm" — Topup giá trị sử dụng thẻ. The value added and the money taken
 * may differ (a promotion); the money defaults to the value.
 */
export function TopupDialog({ card, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  const handleFinish = (values: FormValues) =>
    onSubmit({
      value: values.value ?? 0,
      paidAmount: values.paidAmount ?? values.value ?? 0,
      method: values.method,
      paymentAccountId: values.paymentAccountId ?? null,
      note: values.note?.trim() || null,
    });

  return (
    <AppDialog
      open={card !== null}
      title={t("PrepaidCard:Topup:Title", card?.code ?? "")}
      subtitle={card ? t("PrepaidCard:Topup:Balance", formatVND(card.balance)) : undefined}
      width={560}
      className="prepaid-dialog"
      canSave
      saving={saving}
      saveLabel={t("PrepaidCard:Topup:Submit")}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {card && (
        <Form<FormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ method: SALE_METHOD.Cash }}
          onFinish={handleFinish}
        >
          <Form.Item
            name="value"
            label={t("PrepaidCard:Topup:Value")}
            rules={[{ required: true, type: "number", min: 1, message: t("PrepaidCard:Validation:TopupValue") }]}
          >
            <CurrencyInput suffix=" đ" />
          </Form.Item>
          <Form.Item name="paidAmount" label={t("PrepaidCard:Topup:Paid")} extra={t("PrepaidCard:Topup:PaidHint")}>
            <CurrencyInput suffix=" đ" />
          </Form.Item>
          <MoneyTakenFields />
          <Form.Item name="note" label={t("PrepaidCard:Field:Note")}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
