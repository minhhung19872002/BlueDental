import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { DISCOUNT_TYPE, type PatientAdviseDto } from "../../api/consultingApi";
import {
  SERVICE_LINE_STATUS,
  type TreatmentServiceDto,
  type UpdateTreatmentServiceInput,
} from "../../api/treatmentPlanApi";
import { catalogOptionOf } from "./adviseEditing";
import { toothValueToDtos, type ToothPickerValue } from "./toothPicker";
import type { CreatePlanValues } from "./useCreatePlanForm";

/**
 * "Chỉnh sửa" on a slip's line (owner 2026-10-15): the "Thêm dịch vụ" dialog
 * opened again on that line, which it saves with `PUT services/{lineId}`.
 */
export interface LineEditTarget {
  planId: string;
  service: TreatmentServiceDto;
  /** The consulting line it was written from: a line pulled from one names no advisor of its own. */
  advise: PatientAdviseDto | null;
  /** The slip's advisor, the last fallback. */
  planAdvisorId: string | null;
  planAdvisorName: string | null;
}

export interface LineAdvisors {
  firstId: string | null;
  firstName: string | null;
  secondId: string | null;
  secondName: string | null;
}

/** "Bác sĩ tư vấn" 1 and 2 of the line: its own, else its consulting line's, else the slip's. */
export function lineAdvisors({ service, advise, planAdvisorId, planAdvisorName }: LineEditTarget): LineAdvisors {
  if (service.consultantStaffId) {
    return {
      firstId: service.consultantStaffId,
      firstName: service.consultantName,
      secondId: service.secondConsultantStaffId,
      secondName: service.secondConsultantName,
    };
  }
  if (advise) {
    return {
      firstId: advise.staffId,
      firstName: advise.staffName,
      secondId: advise.secondStaffId,
      secondName: advise.secondStaffName,
    };
  }
  return { firstId: planAdvisorId, firstName: planAdvisorName, secondId: null, secondName: null };
}

/** A line in treatment keeps its price and its discount (Treatment:0038). */
export function isPricingLocked(service: TreatmentServiceDto): boolean {
  return service.status === SERVICE_LINE_STATUS.InProgress;
}

/** The line's service, which may have left the catalog since, for the locked picker. */
export function lineServiceOption(service: TreatmentServiceDto): CatalogOption {
  return catalogOptionOf(service.serviceId, service.serviceName, service.originalPrice);
}

/** What the dialog shows when it opens on the line. */
export function lineToFormValues(target: LineEditTarget): CreatePlanValues {
  const { service } = target;
  const advisors = lineAdvisors(target);
  return {
    serviceId: service.serviceId,
    advisorId: advisors.firstId ?? undefined,
    secondAdvisorId: advisors.secondId ?? undefined,
    staffId: service.diagnoserStaffId ?? undefined,
    diagnosisId: service.secondDiagnoserStaffId ?? undefined,
    note: service.note ?? undefined,
    price: service.price,
    quantity: service.quantity,
    discountType:
      service.discountType === DISCOUNT_TYPE.None ? DISCOUNT_TYPE.Percentage : service.discountType,
    discountValue: service.discountValue,
  };
}

/**
 * The PUT body. The server rewrites every detail it is sent, so what this
 * dialog does not show — diagnosis, dentist, the diagnosing staff — goes back
 * as the line holds it. A line in treatment sends its own discount untouched.
 */
export function lineToUpdateInput(
  service: TreatmentServiceDto,
  values: CreatePlanValues,
  teeth: ToothPickerValue,
): UpdateTreatmentServiceInput {
  const discount = isPricingLocked(service)
    ? { discountType: service.discountType, discountValue: service.discountValue }
    : {
        discountType: values.discountValue ? values.discountType : DISCOUNT_TYPE.None,
        discountValue: values.discountValue ?? 0,
      };
  return {
    price: values.price ?? service.price,
    quantity: values.quantity ?? service.quantity,
    ...discount,
    teeth: toothValueToDtos(teeth),
    diagnosisId: service.diagnosisId,
    dentistId: service.dentistId,
    note: values.note || null,
    diagnoserStaffId: service.diagnoserStaffId,
    secondDiagnoserStaffId: service.secondDiagnoserStaffId,
    consultantStaffId: values.advisorId ?? null,
    secondConsultantStaffId: values.secondAdvisorId ?? null,
  };
}
