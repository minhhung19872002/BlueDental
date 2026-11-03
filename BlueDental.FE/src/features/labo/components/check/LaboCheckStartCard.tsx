import { Button } from "antd";
import { CaretRightOutlined, LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LaboTeethHead } from "./LaboTeethHead";

interface Props {
  toothCount: number;
  editable: boolean;
  busy: boolean;
  onStart: () => void;
}

/**
 * B. before the delivery is in (P3110 m279): a locked card, and «Kiểm tra
 * Labo» saves A. so the order turns Chờ kiểm tra and the teeth open (REQ-D4).
 */
export function LaboCheckStartCard({ toothCount, editable, busy, onStart }: Props) {
  return (
    <section className="pd-labo-check-section">
      <LaboTeethHead status={t("Labo:Check:AwaitStart")} tone="muted" />
      <div className="pd-labo-start-card">
        <span className="pd-labo-start-lock" aria-hidden>
          <LockOutlined />
        </span>
        <strong>{t("Labo:Check:StartTitle", toothCount)}</strong>
        <p>{t("Labo:Check:StartHint")}</p>
        {editable && (
          <Button type="primary" icon={<CaretRightOutlined />} loading={busy} disabled={busy} onClick={onStart}>
            {t("Labo:Check:Start")}
          </Button>
        )}
      </div>
    </section>
  );
}
