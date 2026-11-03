import { Button, Modal } from "antd";
import { Printer } from "lucide-react";
import { Emphasised } from "@/components/Emphasised";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * "In phiếu thu để ký tay?" (P2910_02 mock): asked before a waiting receipt is
 * printed, since printing ends the iPad session and the customer signs the
 * printout at the counter. The BA dropped the mock's grey "Phiên ký trên
 * iPad…" box.
 */
export function ReceiptPaperConfirm({ open, pending, onConfirm, onClose }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={520}
      centered
      closable={false}
      destroyOnHidden
      className="rcpt-paper-dialog"
      footer={
        <div className="rcpt-paper-actions">
          <Button onClick={onClose} disabled={pending}>
            {t("Receipt:Paper:Cancel")}
          </Button>
          <Button type="primary" loading={pending} disabled={pending} onClick={onConfirm}>
            {t("Receipt:Paper:Confirm")}
          </Button>
        </div>
      }
    >
      <span className="rcpt-paper-icon" aria-hidden="true">
        <Printer size={26} />
      </span>
      <h2 className="rcpt-paper-title">{t("Receipt:Paper:Title")}</h2>
      <p className="rcpt-paper-text">
        <Emphasised text={t("Receipt:Paper:Text")} />
      </p>
    </Modal>
  );
}
