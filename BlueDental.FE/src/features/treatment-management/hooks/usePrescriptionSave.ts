import { useState } from "react";
import { toast } from "sonner";
import type { PrescriptionLine } from "@/components/prescription-lines";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import {
  useCreatePrescription,
  useUpdatePrescription,
  type PrescriptionDto,
  type UpdatePrescriptionRequest,
} from "../api/prescriptionApi";
import type { RxDiagnosisRow } from "../types/prescription";
import { printedDiagnosisText } from "../utils/rxDiagnosis";
import type { RxFormValues } from "./usePrescriptionDialogForm";

interface Options {
  patientId: string;
  prescription: PrescriptionDto | null;
  /** Only the lines with a medicine picked. */
  lines: PrescriptionLine[];
  diagnoses: RxDiagnosisRow[];
  legacyDiagnosisText: string | null;
  hasAllergyConflict: boolean;
  onSaved: () => void;
}

function trimmedOrNull(value: string): string | null {
  return value.trim() || null;
}

/**
 * Lưu for the prescription dialog. A medicine the patient is allergic to asks
 * once more first (R-744): the values wait in `pendingValues` until the
 * doctor confirms. Failures are reported by the query client's global handler.
 */
export function usePrescriptionSave(options: Options) {
  const { patientId, prescription, lines, diagnoses, legacyDiagnosisText, hasAllergyConflict, onSaved } =
    options;
  const branchId = useCurrentBranchId();
  const create = useCreatePrescription();
  const update = useUpdatePrescription();
  const [pendingValues, setPendingValues] = useState<RxFormValues | null>(null);

  const submit = async (values: RxFormValues) => {
    const printed = diagnoses.length > 0 ? printedDiagnosisText(diagnoses) : legacyDiagnosisText;
    const input: UpdatePrescriptionRequest = {
      staffId: values.staffId ?? "",
      diagnosisText: printed ? printed : null,
      diagnosisNote: trimmedOrNull(values.diagnosisNote),
      diagnoses: diagnoses.map(({ treatmentPlanId, diagnosisId }) => ({ treatmentPlanId, diagnosisId })),
      note: trimmedOrNull(values.note),
      treatmentType: values.treatmentType,
      followUpDate: values.followUpDate ? values.followUpDate.format("YYYY-MM-DD") : null,
      saveAsTemplate: values.saveAsTemplate,
      templateName: values.saveAsTemplate ? values.templateName.trim() : null,
      items: lines.map((line) => ({
        medicationId: line.medicineEntryId,
        morning: line.morning,
        noon: line.noon,
        afternoon: line.afternoon,
        evening: line.evening,
        days: line.days,
        usage: line.usage,
        otherUsage: line.otherUsage,
      })),
    };

    try {
      if (prescription) {
        await update.mutateAsync({ id: prescription.id, input });
        toast.success(t("Treatment:Prescription:UpdateSuccess"));
      } else {
        await create.mutateAsync({ ...input, patientId, clinicBranchId: branchId });
        toast.success(t("Treatment:Prescription:CreateSuccess"));
      }
      setPendingValues(null);
      onSaved();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const handleFinish = (values: RxFormValues) => {
    if (hasAllergyConflict) setPendingValues(values);
    else void submit(values);
  };

  const handleConfirmAllergy = () => {
    if (pendingValues) void submit(pendingValues);
  };

  const handleCancelAllergy = () => setPendingValues(null);

  return {
    saving: create.isPending || update.isPending,
    confirmingAllergy: pendingValues !== null,
    handleFinish,
    handleConfirmAllergy,
    handleCancelAllergy,
  };
}
