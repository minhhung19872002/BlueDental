import { useState } from "react";
import { Modal } from "antd";
import { Loader2, X } from "lucide-react";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t, tRich } from "@/lib/i18n";
import { useCancelServiceLaboOrders } from "../../../api/treatmentPlanApi";

interface Props {
  planId: string;
  lineId: string;
  onCleared: () => void;
}

/**
 * "Dịch vụ đang có phiếu Labo, vui lòng hủy phiếu Labo trước khi thay đổi
 * dịch vụ." — the reference's block at the foot of the left column while a
 * Labo slip of the line is still with the labo (staging, 2026-09-24). Its
 * button opens the "Xác nhận hủy phiếu Labo" confirm; on Xác nhận every open
 * slip of the line is cancelled and the block goes, with no toast.
 */
export function ConvertLaboBlock({ planId, lineId, onCleared }: Props) {
  const cancel = useCancelServiceLaboOrders();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    try {
      await cancel.mutateAsync({ planId, lineId });
      setConfirming(false);
      onCleared();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <div className="cvt-labo-block">
      <p className="cvt-labo-text">
        {tRich(
          "Treatment:Convert:LaboBlock",
          <strong>{t("Treatment:Convert:LaboSlip")}</strong>,
          <strong>{t("Treatment:Convert:CancelLaboSlipVerb")}</strong>,
        )}
      </p>
      <button type="button" className="tp-btn tp-btn--danger" onClick={() => setConfirming(true)}>
        {t("Treatment:Convert:CancelLaboOrders")}
      </button>

      <Modal
        open={confirming}
        title={t("Treatment:Convert:CancelLaboConfirmTitle")}
        className="tp-dialog pdt-confirm"
        width="min(500px, calc(100vw - 32px))"
        closeIcon={<X size={20} aria-hidden="true" />}
        onCancel={cancel.isPending ? undefined : () => setConfirming(false)}
        maskClosable={!cancel.isPending}
        footer={
          <div className="pdt-confirm-foot">
            <button
              type="button"
              className="tp-btn tp-btn--outline"
              disabled={cancel.isPending}
              onClick={() => setConfirming(false)}
            >
              {t("Common:Close")}
            </button>
            <button
              type="button"
              className="tp-btn tp-btn--primary"
              disabled={cancel.isPending}
              onClick={() => void handleConfirm()}
            >
              {cancel.isPending && <Loader2 size={16} className="pdt-spin" aria-hidden="true" />}
              {t("Common:Confirm")}
            </button>
          </div>
        }
      >
        <p className="pdt-confirm-text">{t("Treatment:Convert:CancelLaboLine1")}</p>
        <p className="pdt-confirm-text">{t("Treatment:Convert:CancelLaboLine2")}</p>
      </Modal>
    </div>
  );
}
