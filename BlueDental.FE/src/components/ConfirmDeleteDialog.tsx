import { Button, Modal } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { t, tRich } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Lowercase noun of what is being deleted, e.g. "nhóm", "thẻ hồ sơ". */
  noun: string;
  /** Name of the record, shown in bold inside the question. */
  name: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The confirmation the reference asks before a delete: the record's own name
 * picked out in bold inside the question, a line saying the action cannot be
 * undone, and a **red** confirm button.
 *
 * The colour is the point — a delete is the one action on these screens that
 * cannot be taken back, so it does not get the same button as save.
 */
export function ConfirmDeleteDialog({ open, noun, name, pending, onConfirm, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("Xác nhận xoá {0}", noun)}</h2>}
      onCancel={onClose}
      width={440}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose} disabled={pending}>
            {t("Huỷ")}
          </Button>
          <Button
            danger
            type="primary"
            icon={<DeleteOutlined />}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? t("Đang xoá…") : t("Xoá")}
          </Button>
        </div>
      }
    >
      <p style={{ margin: 0 }}>
        {tRich("Bạn có chắc muốn xoá {0} {1} không?", noun, <strong>{name}</strong>)}
      </p>
      <p style={{ margin: "4px 0 0", color: "var(--bd-text-muted, #8c8c8c)", fontSize: 13 }}>
        {t("Hành động này không thể hoàn tác.")}
      </p>
    </Modal>
  );
}
