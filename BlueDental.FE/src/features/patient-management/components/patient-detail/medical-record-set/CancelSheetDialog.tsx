import { useState } from "react";
import { Button, Input, Modal } from "antd";
import { t } from "@/lib/i18n";

/**
 * "Hủy phiếu" — what the trash on a sheet card does now. The sheet is not
 * deleted: it stays in the index marked Đã hủy, and the server logs who
 * cancelled it and when, with the reason asked for here. The reason is required.
 */

interface Props {
  /** "Phiếu theo dõi điều trị · Bản 01 · tạo 16/10/2026 09:10". */
  subtitle: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Mount per opening (with a key, or conditionally), so the reason starts empty. */
export function CancelSheetDialog({ subtitle, pending, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = reason.trim().length === 0;

  const handleConfirm = () => {
    setTouched(true);
    if (!missing) onConfirm(reason.trim());
  };

  return (
    <Modal
      open
      width={480}
      className="rs-cancel-dialog"
      title={
        <div>
          <h2 className="bd-modal-title">{t("Patient:MedRecord:CancelTitle")}</h2>
          <p className="bd-modal-subtitle">{subtitle}</p>
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
            <Button
              danger
              type="primary"
              loading={pending}
              disabled={pending}
              onClick={handleConfirm}
            >
              {t("Patient:MedRecord:CancelAction")}
            </Button>
          </div>
        </div>
      }
    >
      <p className="rs-cancel-note rs-cancel-note--warn">{t("Patient:MedRecord:CancelWarning")}</p>
      <label className="rs-cancel-label" htmlFor="rs-cancel-reason">
        {t("Patient:MedRecord:CancelReason")} <span className="rs-required">*</span>
      </label>
      <Input.TextArea
        id="rs-cancel-reason"
        autoFocus
        rows={3}
        maxLength={1000}
        value={reason}
        status={touched && missing ? "error" : undefined}
        onChange={(event) => setReason(event.target.value)}
      />
      {touched && missing && (
        <p className="rs-cancel-error">{t("Patient:MedRecord:CancelReasonRequired")}</p>
      )}
    </Modal>
  );
}
