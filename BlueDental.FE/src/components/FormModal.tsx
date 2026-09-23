// FormModal — standard modal wrapper for forms with consistent footer.

import type { ReactNode } from "react";
import { Modal, Button } from "antd";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
  width?: number;
  children: ReactNode;
}

export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel,
  loading = false,
  width = 640,
  children,
}: Props) {
  const resolvedSubmitLabel = submitLabel ?? t("Common:Save");
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      width={width}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose} disabled={loading}>
            {t("Common:Cancel")}
          </Button>
          {onSubmit && (
            <Button type="primary" onClick={onSubmit} loading={loading}>
              {resolvedSubmitLabel}
            </Button>
          )}
        </div>
      }
      destroyOnHidden
    >
      {children}
    </Modal>
  );
}
