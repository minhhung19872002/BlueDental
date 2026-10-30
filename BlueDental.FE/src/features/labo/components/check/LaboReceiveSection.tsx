import { Button, DatePicker, InputNumber } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { LaboLockedField } from "../order-dialogs/LaboLockedField";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";

interface Props {
  roundNo: number;
  orderedQuantity: number;
  receiverName: string;
  editable: boolean;
  busy: boolean;
  onSave: () => void;
}

/** A. Nhận hàng · lần N: when the delivery came in and how many pieces. */
export function LaboReceiveSection({ roundNo, orderedQuantity, receiverName, editable, busy, onSave }: Props) {
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <span className="pd-labo-check-badge">A</span>
        <h3>{t("Labo:Check:ReceiveTitle", roundNo)}</h3>
        {editable && (
          <Button size="small" icon={<InboxOutlined />} loading={busy} disabled={busy} onClick={onSave}>
            {t("Labo:Check:SaveReceive")}
          </Button>
        )}
      </header>
      <div className="pd-labo-check-grid">
        <FloatingField
          name="receivedAt"
          label={t("Labo:Check:ReceivedAt")}
          required
          alwaysFloat
          rules={requiredRule(t("Labo:Check:ReceivedAtRequired"))}
        >
          <DatePicker
            showTime={{ format: "HH:mm", minuteStep: 5 }}
            needConfirm={false}
            format="DD/MM/YYYY HH:mm"
            className="pd-labo-check-control"
          />
        </FloatingField>
        <FloatingField
          name="receivedQuantity"
          label={t("Labo:Check:ReceivedQuantity")}
          required
          rules={[
            ...requiredRule(t("Labo:Check:ReceivedQuantityRequired")),
            {
              type: "number",
              min: 1,
              max: orderedQuantity,
              message: t("Labo:Check:ReceivedQuantityRange", orderedQuantity),
            },
          ]}
        >
          <InputNumber min={1} max={orderedQuantity} precision={0} className="pd-labo-check-control" />
        </FloatingField>
        {/* Same floating label as the two inputs beside them, so the row lines up. */}
        <LaboLockedField label={t("Labo:Check:OrderedQuantity")} value={String(orderedQuantity)} required={false} />
        <LaboLockedField label={t("Labo:Check:Receiver")} value={receiverName || "—"} required={false} />
      </div>
    </section>
  );
}
