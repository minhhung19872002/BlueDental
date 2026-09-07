import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { CATALOG_GROUP, useCatalogOptions, type CatalogOption } from "@/hooks/useCatalogOptions";
import { useStaffOptions, type StaffOption } from "@/hooks/useStaffOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import {
  SERVICE_LINE_STATUS,
  useAddServiceLine,
  type AddTreatmentServiceInput,
  type TreatmentServiceStatus,
} from "../../api/treatmentPlanApi";
import { EMPTY_TOOTH_VALUE, toothValueToDtos, type ToothPickerValue } from "../plan/toothPicker";

/** What the inline new row holds while it is being filled in. */
export interface DraftServiceValues {
  status: TreatmentServiceStatus;
  diagnosisId: string | null;
  dentistId: string | null;
  teeth: ToothPickerValue;
  quantity: number;
  price: number;
  note: string;
  diagnoserStaffId: string | null;
  secondDiagnoserStaffId: string | null;
  consultantStaffId: string | null;
  secondConsultantStaffId: string | null;
}

/** Everything a draft cell needs: the values, how to change them, save and cancel. */
export interface DraftServiceController {
  service: CatalogOption;
  values: DraftServiceValues;
  update: <K extends keyof DraftServiceValues>(field: K, value: DraftServiceValues[K]) => void;
  openTeeth: () => void;
  save: () => void;
  /** Hủy: asks "Xác nhận xóa" before the row is dropped. */
  cancel: () => void;
  saving: boolean;
  options: { diagnoses: StaffOption[]; dentists: StaffOption[]; staff: StaffOption[] };
}

const EMPTY_VALUES: DraftServiceValues = {
  status: SERVICE_LINE_STATUS.Created,
  diagnosisId: null,
  dentistId: null,
  teeth: EMPTY_TOOTH_VALUE,
  quantity: 1,
  price: 0,
  note: "",
  diagnoserStaffId: null,
  secondDiagnoserStaffId: null,
  consultantStaffId: null,
  secondConsultantStaffId: null,
};

function toInput(service: CatalogOption, values: DraftServiceValues): AddTreatmentServiceInput {
  return {
    serviceId: service.id,
    price: values.price,
    quantity: values.quantity,
    discountType: DISCOUNT_TYPE.None,
    discountValue: 0,
    teeth: toothValueToDtos(values.teeth),
    status: values.status,
    diagnosisId: values.diagnosisId,
    dentistId: values.dentistId,
    note: values.note.trim() || null,
    diagnoserStaffId: values.diagnoserStaffId,
    secondDiagnoserStaffId: values.secondDiagnoserStaffId,
    consultantStaffId: values.consultantStaffId,
    secondConsultantStaffId: values.secondConsultantStaffId,
  };
}

/**
 * The inline "new row" the service picker puts on top of the table. One draft at
 * a time: picking a service starts it (price pre-filled from the catalog),
 * Lưu posts it to the slip, Hủy asks "Xác nhận xóa" and then drops it. The
 * tooth picker and the confirm dialog are owned here so the cell only has to
 * ask for them.
 */
export function useDraftServiceRow(planId: string) {
  const [service, setService] = useState<CatalogOption | null>(null);
  const [values, setValues] = useState<DraftServiceValues>(EMPTY_VALUES);
  const [teethOpen, setTeethOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const add = useAddServiceLine();
  const diagnoses = useCatalogOptions(CATALOG_GROUP.Diagnosis);
  const dentists = useDentistList();
  const staff = useStaffOptions();

  const options = useMemo(
    () => ({
      diagnoses: (diagnoses.data ?? []).map((d) => ({ value: d.id, label: d.name })),
      dentists: (dentists.data ?? []).map((d) => ({ value: d.id, label: d.name })),
      staff: staff.data ?? [],
    }),
    [diagnoses.data, dentists.data, staff.data],
  );

  const start = (picked: CatalogOption) => {
    setService(picked);
    setValues({ ...EMPTY_VALUES, price: picked.price ?? 0 });
  };

  const discard = () => {
    setService(null);
    setValues(EMPTY_VALUES);
    setTeethOpen(false);
    setDiscardOpen(false);
  };

  const save = async () => {
    if (!service) return;
    if (values.quantity < 1) {
      toast.error(t("Số lượng phải lớn hơn 0"));
      return;
    }
    try {
      await add.mutateAsync({ planId, line: toInput(service, values) });
      toast.success(t("Đã thêm dịch vụ"));
      discard();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const controller: DraftServiceController | null = service
    ? {
        service,
        values,
        update: (field, value) => setValues((current) => ({ ...current, [field]: value })),
        openTeeth: () => setTeethOpen(true),
        save: () => void save(),
        cancel: () => setDiscardOpen(true),
        saving: add.isPending,
        options,
      }
    : null;

  return {
    controller,
    start,
    teethOpen,
    confirmTeeth: (teeth: ToothPickerValue) => {
      setValues((current) => ({ ...current, teeth }));
      setTeethOpen(false);
    },
    closeTeeth: () => setTeethOpen(false),
    discardOpen,
    confirmDiscard: discard,
    closeDiscard: () => setDiscardOpen(false),
  };
}
