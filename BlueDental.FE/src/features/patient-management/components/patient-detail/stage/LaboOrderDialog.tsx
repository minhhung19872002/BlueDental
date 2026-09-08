import { Modal } from "antd";
import { t } from "@/lib/i18n";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LaboNewOrderForm } from "../labo/LaboNewOrderForm";
import { sourceFromStage } from "../labo/laboOrderSource";

interface Props {
  open: boolean;
  branchId: string;
  patient: { id: string; code: string; name: string };
  plan: TreatmentPlanSlipDto | null;
  /** The công đoạn the order was raised from; the form opens filled from it. */
  stage: TreatmentStageDto | null;
  onClose: () => void;
}

/**
 * "Đặt mới" raised from a công đoạn's Tạo Labo. The form itself lives with the
 * Labo tab (labo/LaboNewOrderForm), which opens the same dialog without a
 * công đoạn behind it. Measured from the reference on 2026-09-06; see
 * docs/clone/pages/patient-detail.md.
 */
export function LaboOrderDialog({ open, branchId, patient, plan, stage, onClose }: Props) {
  return (
    <Modal
      open={open}
      /* Measured on the reference: 772px, which lands its two columns on 349px. */
      width={772}
      className="pd-labo-dialog"
      title={t("Đặt mới")}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <LaboNewOrderForm
        open={open}
        branchId={branchId}
        patient={patient}
        source={stage ? sourceFromStage(plan, stage) : null}
        onSaved={onClose}
      />
    </Modal>
  );
}
