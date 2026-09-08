import type { CatalogOption } from "@/hooks/useCatalogOptions";
import {
  DISCOUNT_TYPE,
  type PatientAdviseDto,
  type UpdatePatientAdviseDto,
} from "../../api/consultingApi";
import type { CreatePlanValues } from "./useCreatePlanForm";

/** The slip's service may have left the catalog since: keep its name showing in the picker. */
export function withAdviseService(
  services: CatalogOption[],
  advise: PatientAdviseDto | null | undefined,
): CatalogOption[] {
  if (!advise || services.some((item) => item.id === advise.serviceId)) return services;
  return [
    ...services,
    {
      id: advise.serviceId,
      name: advise.serviceName ?? "",
      code: null,
      price: advise.originalPrice,
      taxonomyId: "",
      taxonomyName: null,
      isImageRequired: false,
      content: null,
      description: null,
      prescriptionLines: [],
    },
  ];
}

/** What "Cập nhật phiếu dịch vụ" shows when it opens on an existing slip. */
export function adviseToFormValues(advise: PatientAdviseDto): CreatePlanValues {
  return {
    serviceId: advise.serviceId,
    advisorId: advise.staffId,
    secondAdvisorId: advise.secondStaffId ?? undefined,
    staffId: advise.staffId,
    diagnosisId: advise.diagnosisId,
    note: advise.note ?? undefined,
    price: advise.price,
    quantity: advise.quantity,
    discountType:
      advise.discountType === DISCOUNT_TYPE.None ? DISCOUNT_TYPE.Percentage : advise.discountType,
    discountValue: advise.discountValue,
  };
}

/** The PUT body: what the form may change, over what the slip already carries. */
export function adviseToUpdateDto(
  advise: PatientAdviseDto,
  values: CreatePlanValues,
): UpdatePatientAdviseDto {
  return {
    price: values.price ?? advise.price,
    quantity: values.quantity ?? advise.quantity,
    discountType: values.discountValue ? values.discountType : DISCOUNT_TYPE.None,
    discountValue: values.discountValue ?? 0,
    adviseGroupId: advise.adviseGroupId ?? undefined,
    sortOrder: advise.sortOrder,
    note: values.note || undefined,
  };
}
