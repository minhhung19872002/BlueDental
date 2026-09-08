import { useEffect, useState } from "react";
import { Form } from "antd";
import { toast } from "sonner";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { toothSelectionsToValue } from "@/components/ToothChart";
import { DISCOUNT_TYPE, type DiscountType, type PatientAdviseDto } from "../../api/consultingApi";
import {
  useAcceptAdvise,
  useCreateAdvise,
  useCreateDiagnosis,
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
  /** "Nhân sự tư vấn 1/2" — only asked for on an existing slip. */
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
  const [teeth, setTeeth] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [toothPickerOpen, setToothPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createDiagnosis = useCreateDiagnosis();
  const createAdvise = useCreateAdvise();
  const acceptAdvise = useAcceptAdvise();
  const openPlan = useOpenTreatmentPlan();
  const updateAdvise = useUpdateAdvise();

  // Opening on an existing slip: the fields and the teeth start from it.
  useEffect(() => {
    if (!advise) return;
    form.setFieldsValue(adviseToFormValues(advise));
    setTeeth(toothSelectionsToValue(advise.teeth));
  }, [advise, form]);

  const serviceId = Form.useWatch("serviceId", form);
  const selectedService = services.find((service) => service.id === serviceId) ?? null;
  const watched = Form.useWatch([], form);
  const totals = planTotals(watched ?? { discountType: DISCOUNT_TYPE.Percentage });

  const handleServiceChange = (nextId: string | undefined) => {
    const service = services.find((item) => item.id === nextId);
    form.setFieldsValue({ price: service?.price ?? 0, quantity: service ? 1 : 0 });
  };

  const reset = () => {
    form.resetFields();
    setTeeth(EMPTY_TOOTH_VALUE);
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
      toast.success(t("Đã cập nhật phiếu dịch vụ"));
      reset();
      onCreated();
    } catch (error) {
      toast.error(extractApiError(error) || t("Không thể cập nhật phiếu dịch vụ"));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (isToothValueEmpty(teeth)) {
      toast.error(t("Vui lòng chọn răng"));
      return;
    }
    if (advise) {
      await submitUpdate(values);
      return;
    }
    if (!values.serviceId || !values.staffId || !values.diagnosisId) return;

    setSubmitting(true);
    try {
      const teethDto = toothValueToDtos(teeth);
      const diagnosis = await createDiagnosis.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        diagnosisId: values.diagnosisId,
        staffId: values.staffId,
        teeth: teethDto,
      });
      const advise = await createAdvise.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        patientDiagnosisId: diagnosis.id,
        diagnosisId: values.diagnosisId,
        serviceId: values.serviceId,
        staffId: values.staffId,
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
        dentistId: values.staffId,
        adviseIds: [advise.id],
      });
      toast.success(t("Đã tạo kế hoạch điều trị"));
      reset();
      onCreated();
    } catch (error) {
      toast.error(extractApiError(error) || t("Không thể tạo kế hoạch điều trị"));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    teeth,
    setTeeth,
    toothPickerOpen,
    setToothPickerOpen,
    selectedService,
    totals,
    submitting,
    handleServiceChange,
    submit,
    reset,
  };
}
