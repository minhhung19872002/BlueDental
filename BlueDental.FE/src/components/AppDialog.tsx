import type { ReactNode } from "react";
import { Button, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  title: string;
  /** Modal width in pixels, as Ant Design takes it. */
  width?: number;
  /** Disables the save button — a form that cannot be submitted yet. */
  canSave: boolean;
  saving?: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The dialog shell every "Danh mục" screen uses, matching the reference: a bold
 * title with a rule under it, the form, and a rule above a single right-aligned
 * save button.
 *
 * There is deliberately **no cancel button** — the reference offers only the X,
 * and a cancel next to save is the kind of small difference that reads as a
 * different application.
 */
export function AppDialog({
  open,
  title,
  width = 560,
  canSave,
  saving,
  onSave,
  onClose,
  children,
}: Props) {
  return (
    <Modal
      open={open}
      // antd puts its title in a plain div; a dialog's title is a heading.
      title={<h2 className="bd-modal-title">{title}</h2>}
      onCancel={onClose}
      width={width}
      destroyOnHidden
      mask={{ closable: false }}
      className="app-dialog"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {/* A disabled button says "not now"; a spinner says "working". The
              save can take a moment, so it has to say which. */}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canSave || saving}
            onClick={onSave}
          >
            {saving ? t("Đang lưu…") : t("Lưu")}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
