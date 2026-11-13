import { Modal } from "antd";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t, tRich } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { formatMoneyUnit } from "@/utils/format";
import { useRestoreServiceLine, type TreatmentServiceDto } from "../../api/treatmentPlanApi";

interface Props {
  planId: string;
  /** The "Hủy dịch vụ" line to bring back; null keeps the dialog closed. */
  service: TreatmentServiceDto | null;
  onClose: () => void;
}

/**
 * "Xác nhận khôi phục dịch vụ" (owner 2026-11-13, R-1230) — the twin of
 * CancelServiceDialog. A line refunded after its cancel owes that money again
 * once restored, so the dialog says so in red before the user commits.
 */
export function RestoreServiceDialog({ planId, service, onClose }: Props) {
  const restore = useRestoreServiceLine();
  const saving = restore.isPending;
  const refunded = service?.refundedAmount ?? 0;

  const handleConfirm = async () => {
    if (!service) return;
    try {
      await restore.mutateAsync({ planId, lineId: service.id });
      toast.success(t("Treatment:Service:RestoreSuccess"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <Modal
      open={service !== null}
      title={t("Treatment:Service:RestoreServiceConfirm")}
      className="tp-dialog pdt-confirm"
      width="min(500px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={saving ? undefined : onClose}
      maskClosable={!saving}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--outline" disabled={saving} onClick={onClose}>
            {t("Common:No")}
          </button>
          <button type="button" className="tp-btn tp-btn--primary" disabled={saving} onClick={handleConfirm}>
            {saving && <Loader2 size={16} className="pdt-spin" aria-hidden="true" />}
            {t("Treatment:Service:RestoreService")}
          </button>
        </div>
      }
    >
      <p className="pdt-confirm-text">
        {tRich(
          "Treatment:Service:RestoreQuestion",
          <strong>&quot;{service?.serviceName ?? ""}&quot;</strong>,
        )}
      </p>
      {refunded > 0 && (
        <p className="pdt-confirm-text pdt-confirm-warn" role="alert">
          {t("Treatment:Service:RestoreRefundWarning", formatMoneyUnit(refunded))}
        </p>
      )}
    </Modal>
  );
}
