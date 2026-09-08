import type { ReactNode } from "react";
import { Button, Modal } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Heading. The reference titles most of these plainly "Xác nhận". */
  title?: string;
  /** The question, or a short line saying what confirming will do. */
  message: ReactNode;
  /** Label of the confirm button, when "Có" is not the right word. */
  confirmLabel?: string;
  /** Label of the dismiss button, when "Không" is not the right word. */
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The plain yes/no the reference asks before an action that is not a delete —
 * "Không" beside a blue "Có". Deletes keep their own red dialog
 * (`ConfirmDeleteDialog`), which also carries the "cannot be undone" line.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{title ?? t("Xác nhận")}</h2>}
      onCancel={onClose}
      width={500}
      destroyOnHidden
      footer={
        <div className="bd-confirm-actions">
          <Button onClick={onClose} disabled={pending}>
            {cancelLabel ?? t("Không")}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("Có")}
          </Button>
        </div>
      }
    >
      <p className="bd-confirm-message">{message}</p>
    </Modal>
  );
}
