import { useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
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
  services: CatalogOption[];
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

  const save = async ({ header, teeth, services, rows }: SaveInput) => {
    if (!header.staffId || rows.size === 0) return;
    const selections = toothValueToSelections(teeth);
    const ticked = services.filter((service) => rows.has(service.id));

    setSaving(true);
    let created = 0;
    try {
      for (const service of ticked) {
        const row = rows.get(service.id);
        if (!row) continue;
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
          toast.error(t("Không thể tạo dịch vụ {0}: {1}", service.name, extractApiError(error)));
          if (created > 0) onCreated?.();
          return;
        }
      }
      toast.success(t("Đã tạo {0} dịch vụ tư vấn", created));
      onCreated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
