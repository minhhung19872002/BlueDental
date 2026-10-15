import { useMemo, useState } from "react";
import { Modal } from "antd";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { TreatmentStagePanel } from "./TreatmentStagePanel";
import { useStageComposer } from "./stage/useStageComposer";
import { useStageTabs } from "./stage/useStageTabs";

interface Props {
  open: boolean;
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
  /** The slip the clicked row belongs to. */
  plan: TreatmentPlanSlipDto | null;
  /** The line of the row that was clicked. */
  focusServiceId: string | null;
  /** The công đoạn of that row — the dialog lands on the tab its work is in. */
  focusStageId?: string | null;
  onClose: () => void;
  /**
   * "Thanh toán" — the reference leaves the dialog for the slip's Kế hoạch
   * điều trị screen rather than opening a payment form here.
   */
  onOpenPlan: () => void;
}

/**
 * "Chi tiết phiếu" — the dialog behind the treatment table's Công đoạn cell.
 *
 * Laid out from the reference's own dialog; its body is
 * {@link TreatmentStagePanel}, which the slip page also shows inline. Everything
 * it reads and writes lives in {@link useStageComposer}. See
 * docs/clone/pages/patient-detail.md.
 */
export function TreatmentStageDialog({
  open,
  patientId,
  patientCode,
  patientName,
  branchId,
  plan,
  focusServiceId,
  focusStageId = null,
  onClose,
  onOpenPlan,
}: Props) {
  const allowedTabs = useStageTabs();
  const composer = useStageComposer({
    open,
    patientId,
    branchId,
    plan,
    focusServiceId,
    focusStageId,
    allowedTabs,
  });
  const patient = useMemo(
    () => ({ id: patientId, code: patientCode, name: patientName }),
    [patientId, patientCode, patientName],
  );
  const [discarding, setDiscarding] = useState(false);

  /**
   * Leaving with something written asks first. The reference hangs one guarded
   * close off both the ✕ and the form's "Hủy", so "Hủy" leaves the whole
   * "Chi tiết phiếu" — it does not just drop the picked cards.
   */
  const requestClose = () => {
    if (composer.dirty) setDiscarding(true);
    else onClose();
  };

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className="pd-stage-dialog"
      title={t("Patient:Stage:SlipDetail")}
      footer={null}
      onCancel={requestClose}
      destroyOnHidden
    >
      <TreatmentStagePanel
        patient={patient}
        branchId={branchId}
        plan={plan}
        composer={composer}
        allowedTabs={allowedTabs}
        onCancel={requestClose}
        onOpenPlan={onOpenPlan}
      />

      <ConfirmDeleteDialog
        open={discarding}
        noun={t("Patient:Misc:Change")}
        title={t("Patient:Misc:CancelChanges")}
        question={t("Patient:Misc:ConfirmCancelQuestion")}
        confirmLabel={t("Patient:Misc:ConfirmCancel")}
        cancelLabel={t("Patient:Misc:ContinueEditing")}
        onConfirm={() => {
          setDiscarding(false);
          onClose();
        }}
        onClose={() => setDiscarding(false)}
      />
    </Modal>
  );
}
