import { useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { toothValueToSelections, type ToothPickerValue } from "@/components/ToothChart";
import type { CatalogComboOption } from "@/hooks/useCatalogCombos";
import { useCreateAdvise } from "../../api/consultingQueries";
import { DISCOUNT_TYPE, type DiscountType, type PatientDiagnosisDto } from "../../api/consultingApi";
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
  combos: ReadonlyMap<string, CatalogComboOption>;
}

/** One advise to create — a ticked service with what was typed on it, or a picked combo. */
interface AdviseLine {
  name: string;
  serviceId: string;
  originalPrice: number;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  note?: string;
}

function linesOf(rows: ReadonlyMap<string, AdviseRowDraft>, combos: ReadonlyMap<string, CatalogComboOption>): AdviseLine[] {
  // In the order they were ticked — the drafts keep it.
  const singles = [...rows.values()].map((row) => ({
    name: row.service.name,
    serviceId: row.service.id,
    // The line is sold at "Giá sau giảm", and that is its giá gốc too:
    // the catalogue's own discount is not a discount on the line.
    originalPrice: row.service.salePrice ?? row.price,
    price: row.price,
    quantity: row.quantity,
    discountType: row.discountValue > 0 ? row.discountType : DISCOUNT_TYPE.None,
    discountValue: row.discountValue > 0 ? row.discountValue : 0,
    note: row.note.trim() || undefined,
  }));
  // A combo is one service of the catalogue in its own right — its stages,
  // warranty and labo are set on it — so it becomes one line at its price.
  const picked = [...combos.values()].map((combo) => ({
    name: combo.name,
    serviceId: combo.id,
    originalPrice: combo.salePrice,
    price: combo.salePrice,
    quantity: 1,
    discountType: DISCOUNT_TYPE.None,
    discountValue: 0,
  }));
  return [...singles, ...picked];
}

/**
 * "Lưu" on "Chọn Dịch Vụ": one advise per ticked service and per picked
 * combo, all hanging off the same diagnosis slip and carrying the teeth the
 * dialog shows. The API takes
 * them one at a time, so a failure part-way leaves the earlier ones created —
 * the dialog stays open and the error names the service that was refused.
 */
export function useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose }: Options) {
  const createAdvise = useCreateAdvise();
  const [saving, setSaving] = useState(false);

  const save = async ({ header, teeth, rows, combos }: SaveInput) => {
    const lines = linesOf(rows, combos);
    if (!header.staffId || lines.length === 0) return;
    const selections = toothValueToSelections(teeth);

    setSaving(true);
    let created = 0;
    try {
      for (const { name, ...line } of lines) {
        try {
          await createAdvise.mutateAsync({
            patientId,
            clinicBranchId: branchId,
            patientDiagnosisId: diagnosis.id,
            diagnosisId: diagnosis.diagnosisId,
            staffId: header.staffId,
            secondStaffId: header.secondStaffId || undefined,
            ...line,
            teeth: selections,
          });
          created += 1;
        } catch (error) {
          toast.error(t("Treatment:Service:AddServiceError", name, extractApiError(error)));
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
