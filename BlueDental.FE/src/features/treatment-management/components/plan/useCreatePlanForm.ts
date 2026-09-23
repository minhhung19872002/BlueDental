import { useEffect, useState } from "react";
import { Form } from "antd";
import { toast } from "sonner";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { toothSelectionsToValue } from "@/components/ToothChart";
import { DISCOUNT_TYPE, type DiscountType, type PatientAdviseDto } from "../../api/consultingApi";
import {
  useAcceptAdvise,
  useCreateAdvise,
  useUpdateAdvise,
} from "../../api/consultingQueries";
import { useOpenTreatmentPlan } from "../../api/treatmentPlanApi";
import { adviseToFormValues, adviseToUpdateDto } from "./adviseEditing";
import {
  EMPTY_TOOTH_VALUE,
  isToothValueEmpty,
  toothValueToDtos,
  type ToothPickerValue,
} from "./toothPicker";

export interface CreatePlanValues {
  serviceId?: string;
  /** "Nhân sự tư vấn 1/2" — the staff who advised; both modes ask for them. */
  advisorId?: string;
  secondAdvisorId?: string;
  staffId?: string;
  diagnosisId?: string;
  note?: string;
  price?: number;
  quantity?: number;
  discountType: DiscountType;
  discountValue?: number;
}

/** Messages the dialog prints under the field they belong to. */
export interface PlanFieldErrors {
  teeth?: string;
  diagnosis?: string;
}

export interface PlanTotals {
  gross: number;
  discount: number;
  effective: number;
}

export function planTotals(values: Partial<CreatePlanValues>): PlanTotals {
  const gross = (values.price ?? 0) * (values.quantity ?? 0);
  const rate = values.discountValue ?? 0;
  const discount =
    values.discountType === DISCOUNT_TYPE.Money
      ? rate
      : values.discountType === DISCOUNT_TYPE.Percentage
        ? (gross * rate) / 100
        : 0;
  return { gross, discount, effective: Math.max(gross - discount, 0) };
}

interface Options {
  patientId: string;
  branchId: string;
  services: CatalogOption[];
  /** An existing slip to edit ("Cập nhật phiếu dịch vụ"); null or absent creates one. */
  advise?: PatientAdviseDto | null;
  onCreated: () => void;
}

/**
 * The "Tạo phiếu dịch vụ" form. Saving runs the existing chain — diagnosis →
 * advise → accept → open slip — because the backend opens a slip only from an
 * accepted advise. The reference's own save request was not observed
 * (docs/clone/unknowns.md), so the form mirrors its fields, not its wire shape.
 */
export function useCreatePlanForm({ patientId, branchId, services, advise, onCreated }: Options) {
  const [form] = Form.useForm<CreatePlanValues>();
  const [teeth, setTeethValue] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [fieldErrors, setFieldErrors] = useState<PlanFieldErrors>({});

  /** Picking teeth answers the error the save asked about. */
  const setTeeth = (value: ToothPickerValue) => {
    setTeethValue(value);
    if (!isToothValueEmpty(value)) setFieldErrors((prev) => ({ ...prev, teeth: undefined }));
  };
  const [toothPickerOpen, setToothPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createAdvise = useCreateAdvise();
  const acceptAdvise = useAcceptAdvise();
  const openPlan = useOpenTreatmentPlan();
  const updateAdvise = useUpdateAdvise();

  // Opening on an existing slip: the fields and the teeth start from it.
  useEffect(() => {
    if (!advise) return;
    form.setFieldsValue(adviseToFormValues(advise));
    setTeethValue(toothSelectionsToValue(advise.teeth));
  }, [advise, form]);

  const serviceId = Form.useWatch("serviceId", form);
  /**
   * The picker searches the server, so the catalog is not held here any more —
   * it hands the whole entry over and this keeps the last one for the price and
   * the summary. `services` still carries the slip's own service when editing.
   */
  const [pickedService, setPickedService] = useState<CatalogOption | null>(null);
  const selectedService =
    (serviceId ? services.find((service) => service.id === serviceId) : null) ??
    (pickedService?.id === serviceId ? pickedService : null);
  const watched = Form.useWatch([], form);
  const totals = planTotals(watched ?? { discountType: DISCOUNT_TYPE.Percentage });

  const handlePickService = (service: CatalogOption) => {
    setPickedService(service);
    form.setFieldsValue({ price: service.price ?? 0, quantity: 1 });
  };

  /** The field was cleared from the Select's own × rather than by a pick. */
  const handleServiceCleared = () => {
    setPickedService(null);
    form.setFieldsValue({ price: 0, quantity: 0 });
  };

  const reset = () => {
    form.resetFields();
    setPickedService(null);
    setTeethValue(EMPTY_TOOTH_VALUE);
    setFieldErrors({});
  };

  /**
   * The update path. The backend's PUT takes pricing, discount, group and
   * order only — the advisors, teeth and note it shows are not persisted yet.
   */
  const submitUpdate = async (values: CreatePlanValues) => {
    if (!advise) return;
    setSubmitting(true);
    try {
      await updateAdvise.mutateAsync({ id: advise.id, data: adviseToUpdateDto(advise, values) });
      toast.success(t("Treatment:Plan:UpdateSuccess"));
      reset();
      onCreated();
    } catch (error) {
      notifyError(extractApiError(error) || t("Treatment:Plan:UpdateError"));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    const values = await form.validateFields();

    // Reported under the field rather than as a toast: a toast leaves the user
    // hunting for what it meant once it has faded.
    const errors: PlanFieldErrors = {};
    if (isToothValueEmpty(teeth)) errors.teeth = t("Treatment:Tooth:ToothRequired");
    setFieldErrors(errors);
    if (errors.teeth) return;

    if (advise) {
      await submitUpdate(values);
      return;
    }
    // The doctor who advised stands in when no diagnosing doctor was named —
    // the two diagnosis fields are read-only on this form.
    const dentistId = values.staffId ?? values.advisorId;
    if (!values.serviceId || !dentistId) return;

    setSubmitting(true);
    try {
      const teethDto = toothValueToDtos(teeth);
      // No chẩn đoán is filed here: saving writes the service line and the
      // slip, and nothing else (measured against the reference 2026-09-22).
      const advise = await createAdvise.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        patientDiagnosisId: null,
        diagnosisId: values.diagnosisId ?? null,
        serviceId: values.serviceId,
        // The advise belongs to whoever advised; the diagnosis keeps the
        // diagnosing doctor. The reference sends the same pair.
        staffId: values.advisorId ?? dentistId,
        secondStaffId: values.secondAdvisorId,
        originalPrice: selectedService?.price ?? values.price ?? 0,
        price: values.price ?? 0,
        quantity: values.quantity ?? 1,
        discountType: values.discountValue ? values.discountType : DISCOUNT_TYPE.None,
        discountValue: values.discountValue ?? 0,
        note: values.note || undefined,
        teeth: teethDto,
      });
      await acceptAdvise.mutateAsync(advise.id);
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId,
        adviseIds: [advise.id],
      });
      toast.success(t("Treatment:Plan:CreateSuccess"));
      reset();
      onCreated();
    } catch (error) {
      notifyError(extractApiError(error) || t("Treatment:Plan:CreateError"));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    teeth,
    setTeeth,
    fieldErrors,
    toothPickerOpen,
    setToothPickerOpen,
    selectedService,
    totals,
    submitting,
    handlePickService,
    handleServiceCleared,
    submit,
    reset,
  };
}
