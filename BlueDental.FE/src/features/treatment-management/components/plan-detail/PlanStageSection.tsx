import { useMemo, useRef, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TreatmentStagePanel } from "@/features/patient-management/components/patient-detail/TreatmentStagePanel";
import { useStageComposer } from "@/features/patient-management/components/patient-detail/stage/useStageComposer";
import { useStageTabs } from "@/features/patient-management/components/patient-detail/stage/useStageTabs";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { t } from "@/lib/i18n";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
  /** The row picked in the service table above; null shows every line. */
  serviceId: string | null;
}

/**
 * "Chi tiết phiếu" laid straight into the slip page under its service table,
 * always open, instead of the patient record's dialog (BA 2026-10-15). Picking
 * a row above narrows the cards and the history to that line.
 *
 * "Hủy" here closes the open card — there is no dialog to leave — asking first
 * when something was written in it. No "Thanh toán" button: the slip page has
 * its own payment tabs (owner 2026-10-15). Once "Lịch sử điều trị" scrolls
 * into view a back-to-top button shows bottom-right (owner 2026-10-15).
 */
export function PlanStageSection({ patient, plan, branchId, serviceId }: Props) {
  const allowedTabs = useStageTabs();
  const composer = useStageComposer({
    open: true,
    patientId: patient.id,
    branchId,
    plan,
    focusServiceId: null,
    filterServiceId: serviceId,
    allowedTabs,
  });
  const stagePatient = useMemo(
    () => ({ id: patient.id, code: patient.patientCode, name: patient.fullName }),
    [patient.id, patient.patientCode, patient.fullName],
  );
  const [discarding, setDiscarding] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const handleCancel = () => {
    if (composer.chosenDirty) setDiscarding(true);
    else composer.discard();
  };

  return (
    <section className="pdt-stage" aria-label={t("Patient:Stage:SlipDetail")}>
      <TreatmentStagePanel
        patient={stagePatient}
        branchId={branchId}
        plan={plan}
        composer={composer}
        allowedTabs={allowedTabs}
        onCancel={handleCancel}
        historyRef={historyRef}
      />
      <ScrollTopButton anchor={historyRef} />
      <ConfirmDeleteDialog
        open={discarding}
        noun={t("Patient:Misc:Change")}
        title={t("Patient:Misc:CancelChanges")}
        question={t("Patient:Misc:ConfirmCancelQuestion")}
        confirmLabel={t("Patient:Misc:ConfirmCancel")}
        cancelLabel={t("Patient:Misc:ContinueEditing")}
        onConfirm={() => {
          setDiscarding(false);
          composer.discard();
        }}
        onClose={() => setDiscarding(false)}
      />
    </section>
  );
}
