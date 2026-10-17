import { Button, Modal } from "antd";
import { t } from "@/lib/i18n";
import type { RecordSetDto } from "../../../api/medicalRecordSetApi";

/**
 * "Hủy bộ hồ sơ". Not a delete: the set stays, marked Đã hủy, at the bottom
 * of the list and can no longer change; its treatment slips read "Chưa thêm
 * vào bệnh án" again and may go into another set.
 */

interface Props {
  set: RecordSetDto;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelRecordSetDialog({ set, pending, onConfirm, onClose }: Props) {
  const slips = set.plans.map((plan) => plan.planCode).join(", ");

  return (
    <Modal
      open
      width={480}
      className="rs-cancel-dialog"
      title={
        <div>
          <h2 className="bd-modal-title">{t("Patient:RecordSet:CancelTitle")}</h2>
          <p className="bd-modal-subtitle">
            {t("Patient:RecordSet:CancelSlips", set.code, set.plans.length, slips)}
          </p>
        </div>
      }
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="bd-modal-foot">
          <div />
          <div className="bd-modal-foot-actions">
            <Button disabled={pending} onClick={onClose}>
              {t("Patient:RecordSet:Back")}
            </Button>
            <Button danger type="primary" loading={pending} disabled={pending} onClick={onConfirm}>
              {t("Patient:RecordSet:CancelAction")}
            </Button>
          </div>
        </div>
      }
    >
      <p className="rs-cancel-note rs-cancel-note--danger">
        {t("Patient:RecordSet:CancelWarning")}
      </p>
    </Modal>
  );
}
