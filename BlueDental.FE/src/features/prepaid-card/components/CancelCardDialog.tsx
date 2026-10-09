import { Form, Input } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { CardDetailDto } from "../types";

interface Props {
  card: CardDetailDto | null;
  saving: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

/** Money taken for the card: its sale and every top-up. */
const moneyTaken = (card: CardDetailDto) => card.transactions.reduce((sum, tx) => sum + tx.paidAmount, 0);

/**
 * "Huỷ thẻ" — undoes a sale made by mistake. Only offered for a card that has
 * never paid for a service; the money taken is given back and the seller
 * earns no commission. Final.
 */
export function CancelCardDialog({ card, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<{ reason: string }>();

  return (
    <AppDialog
      open={card !== null}
      title={t("PrepaidCard:Cancel:Title", card?.code ?? "")}
      subtitle={card ? t("PrepaidCard:Cancel:Hint", formatVND(moneyTaken(card))) : undefined}
      width={520}
      className="prepaid-dialog"
      canSave
      saving={saving}
      saveLabel={t("PrepaidCard:Cancel:Submit")}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {card && (
        <Form form={form} layout="vertical" preserve={false} onFinish={(values) => onSubmit(values.reason.trim())}>
          <Form.Item
            name="reason"
            label={t("PrepaidCard:Cancel:Reason")}
            rules={[{ required: true, whitespace: true, message: t("PrepaidCard:Validation:CancelReason") }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
