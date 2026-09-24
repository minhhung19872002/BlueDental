import { useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { toothValueToSelections, type ToothPickerValue } from "@/components/ToothChart";
import { useCreateAdvise } from "../../api/consultingQueries";
import { DISCOUNT_TYPE, type PatientDiagnosisDto } from "../../api/consultingApi";
import type { AdviseHeaderValues, AdviseRowDraft } from "./adviseTypes";

interface Options {
  patientId: string;
  branchId: string;
  diagnosis: PatientDiagnosisDto;
  onCreated?: () => void;
  onClose: () => void;
}

export interface SaveInput {
  header: AdviseHeaderValues;
  teeth: ToothPickerValue;
  rows: ReadonlyMap<string, AdviseRowDraft>;
}

/**
 * "Lưu" on "Chọn Dịch Vụ": one advise per ticked service, all hanging off the
 * same diagnosis slip and carrying the teeth the dialog shows. The API takes
 * them one at a time, so a failure part-way leaves the earlier ones created —
 * the dialog stays open and the error names the service that was refused.
 */
export function useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose }: Options) {
  const createAdvise = useCreateAdvise();
  const [saving, setSaving] = useState(false);

  const save = async ({ header, teeth, rows }: SaveInput) => {
    if (!header.staffId || rows.size === 0) return;
    const selections = toothValueToSelections(teeth);

    setSaving(true);
    let created = 0;
    try {
      // In the order they were ticked — the drafts keep it.
      for (const row of rows.values()) {
        const { service } = row;
        try {
          await createAdvise.mutateAsync({
            patientId,
            clinicBranchId: branchId,
            patientDiagnosisId: diagnosis.id,
            diagnosisId: diagnosis.diagnosisId,
            serviceId: service.id,
            staffId: header.staffId,
            secondStaffId: header.secondStaffId || undefined,
            originalPrice: service.price ?? row.price,
            price: row.price,
            quantity: row.quantity,
            discountType: row.discountValue > 0 ? row.discountType : DISCOUNT_TYPE.None,
            discountValue: row.discountValue > 0 ? row.discountValue : 0,
            note: row.note.trim() || undefined,
            teeth: selections,
          });
          created += 1;
        } catch (error) {
          toast.error(t("Treatment:Service:AddServiceError", service.name, extractApiError(error)));
          if (created > 0) onCreated?.();
          return;
        }
      }
      toast.success(t("Treatment:Service:CreateAdviseSuccess", created));
      onCreated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
