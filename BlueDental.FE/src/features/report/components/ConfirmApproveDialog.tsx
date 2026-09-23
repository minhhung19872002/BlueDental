import { Button, Modal } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { t, tRich } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** The voucher's Nội dung chi, shown in bold inside the question. */
  description: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The reference asks before approving an expense: "Xác nhận duyệt", the
 * voucher's content in bold, a "cannot be undone" line, then Huỷ / Duyệt.
 */
export function ConfirmApproveDialog({ open, description, pending, onConfirm, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("Report:ConfirmApprove:Title")}</h2>}
      onCancel={onClose}
      width={440}
      destroyOnHidden
      footer={
        <div className="report-confirm-footer">
          <Button onClick={onClose} disabled={pending}>
            {t("Common:Cancel")}
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} loading={pending} disabled={pending} onClick={onConfirm}>
            {t("Report:ConfirmApprove:Approve")}
          </Button>
        </div>
      }
    >
      <p className="report-confirm-question">
        {tRich("Report:Confirm:ApproveExpenseSlip", <strong>{description}</strong>)}
      </p>
      <p className="report-confirm-note">{t("Common:CannotUndone")}</p>
    </Modal>
  );
}
