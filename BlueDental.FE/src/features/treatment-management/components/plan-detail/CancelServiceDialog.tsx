import { Modal } from "antd";
import { Loader2, X } from "lucide-react";
import { t, tRich } from "@/lib/i18n";
import type { TreatmentServiceDto } from "../../api/treatmentPlanApi";

interface Props {
  service: TreatmentServiceDto | null;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** "Xác nhận hủy dịch vụ" — the 500px confirm the status menu opens. */
export function CancelServiceDialog({ service, saving, onConfirm, onClose }: Props) {
  return (
    <Modal
      open={service !== null}
      title={t("Xác nhận hủy dịch vụ")}
      className="tp-dialog pdt-confirm"
      width="min(500px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={saving ? undefined : onClose}
      maskClosable={!saving}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--outline" disabled={saving} onClick={onClose}>
            {t("Không")}
          </button>
          <button
            type="button"
            className="tp-btn tp-btn--danger"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving && <Loader2 size={16} className="pdt-spin" aria-hidden="true" />}
            {t("Hủy dịch vụ")}
          </button>
        </div>
      }
    >
      <p className="pdt-confirm-text">
        {tRich(
          "Bạn có chắc chắn hủy dịch vụ {0}? Thao tác này không thể hoàn tác.",
          <strong>&quot;{service?.serviceName ?? ""}&quot;</strong>,
        )}
      </p>
    </Modal>
  );
}
