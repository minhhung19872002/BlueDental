import type { ReactNode } from "react";
import { Button, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  title: string;
  /** Modal width — number (px) or CSS string like "calc(100vw - 80px)". */
  width?: number | string;
  /** Extra class on the modal, next to the shared app-dialog styling. */
  className?: string;
  /** Disables the save button — a form that cannot be submitted yet. */
  canSave: boolean;
  saving?: boolean;
  /** Save button label; defaults to "Lưu". */
  saveLabel?: string;
  /** A line under the title, where the reference explains what the form is for. */
  subtitle?: string;
  /** Sits beside the title — the reference puts the receiving department here. */
  titleExtra?: ReactNode;
  /** Fills the empty left half of the footer, e.g. a count of what is listed. */
  footerLeft?: ReactNode;
  /**
   * Adds a "Huỷ" beside the save. Danh mục's dialogs deliberately have none —
   * see below — so this is opt-in, for the screens whose reference shows one.
   */
  cancelLabel?: string;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The dialog shell every "Danh mục" screen uses, matching the reference: a bold
 * title with a rule under it, the form, and a rule above a single right-aligned
 * save button.
 *
 * Danh mục's dialogs deliberately have **no cancel button** — that reference
 * offers only the X, and a cancel next to save is the kind of small difference
 * that reads as a different application. Screens whose own reference does show
 * one pass `cancelLabel`; the default stays as it was.
 */
export function AppDialog({
  open,
  title,
  width = 560,
  className,
  canSave,
  saving,
  saveLabel,
  subtitle,
  titleExtra,
  footerLeft,
  cancelLabel,
  onSave,
  onClose,
  children,
}: Props) {
  return (
    <Modal
      open={open}
      // antd puts its title in a plain div; a dialog's title is a heading.
      title={
        <div className="bd-modal-head">
          <div className="bd-min0">
            <h2 className="bd-modal-title">{title}</h2>
            {subtitle ? <p className="bd-modal-subtitle">{subtitle}</p> : null}
          </div>
          {titleExtra}
        </div>
      }
      onCancel={onClose}
      width={width}
      destroyOnHidden
      mask={{ closable: false }}
      className={["app-dialog", className].filter(Boolean).join(" ")}
      footer={
        <div className="bd-modal-foot">
          <div className="bd-min0">{footerLeft}</div>
          <div className="bd-modal-foot-actions">
            {cancelLabel ? (
              <Button disabled={saving} onClick={onClose}>
                {cancelLabel}
              </Button>
            ) : null}
            {/* A disabled button says "not now"; a spinner says "working". The
                save can take a moment, so it has to say which. */}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving ? t("Đang lưu…") : saveLabel ?? t("Lưu")}
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
