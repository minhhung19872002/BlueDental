import { Modal } from "antd";
import { t, tRich } from "@/lib/i18n";

interface UnsavedPermsDialogProps {
  open: boolean;
  roleName: string | null;
  onStay: () => void;
  onDiscard: () => void;
}

/** Asked before leaving a role whose permission ticks have not been saved. */
export function UnsavedPermsDialog({ open, roleName, onStay, onDiscard }: UnsavedPermsDialogProps) {
  return (
    <Modal
      open={open}
      title={t("Organization:UnsavedPermsTitle")}
      okText={t("Organization:UnsavedPermsDiscard")}
      cancelText={t("Organization:UnsavedPermsStay")}
      okButtonProps={{ danger: true }}
      onOk={onDiscard}
      onCancel={onStay}
    >
      <p>{tRich("Organization:UnsavedPermsContent", <strong>{roleName}</strong>)}</p>
    </Modal>
  );
}
