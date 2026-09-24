import { useState } from "react";
import { toast } from "sonner";
import { toothSelectionsToValue } from "@/components/ToothChart";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  SERVICE_LINE_STATUS,
  useUpdateServiceLine,
  type TreatmentServiceDto,
} from "../../api/treatmentPlanApi";
import { toothValueToDtos, type ToothPickerValue } from "../plan/toothPicker";
import type { PlanDetailRow } from "./planDetailTypes";
import type { DraftServiceController, DraftServiceValues } from "./useDraftServiceRow";

/**
 * Whether the plan table offers "Chỉnh sửa" on a line — staging's own rule,
 * read off its column builder 2026-09-24: not done, cancelled or converted, and
 * nothing paid on it yet.
 */
export function isLineEditable(service: TreatmentServiceDto): boolean {
  const closed =
    service.status === SERVICE_LINE_STATUS.Done ||
    service.status === SERVICE_LINE_STATUS.Cancelled ||
    service.status === SERVICE_LINE_STATUS.Replaced;
  return !closed && service.paidAmount <= 0;
}

function valuesOf(row: PlanDetailRow): DraftServiceValues {
  const { service } = row;
  // A line pulled from a consulting line reads its diagnosis off the advise.
  // Offering that as the starting pick is only safe while the diagnosis may
  // still change: a line in treatment sends its own, unchanged.
  const inTreatment = service.status === SERVICE_LINE_STATUS.InProgress;
  return {
    status: service.status,
    diagnosisId: service.diagnosisId ?? (inTreatment ? null : (row.advise?.diagnosisId ?? null)),
    dentistId: service.dentistId,
    teeth: toothSelectionsToValue(service.teeth),
    quantity: service.quantity,
    price: service.price,
    note: service.note ?? "",
    diagnoserStaffId: service.diagnoserStaffId,
    secondDiagnoserStaffId: service.secondDiagnoserStaffId,
    consultantStaffId: service.consultantStaffId,
    secondConsultantStaffId: service.secondConsultantStaffId,
  };
}

/**
 * "Chỉnh sửa" — the pencil in the plan table's Thao tác column, which turns a
 * saved line back into the inline row the new-service picker draws, with ✓ Lưu
 * and ✕ Hủy in place of the eye.
 *
 * Measured on staging 2026-09-24: a line in treatment keeps its diagnosis and
 * its price (the cells read "Không thể đổi chẩn đoán/giá khi đang điều trị"),
 * and the tooth picker will not let go of a tooth that already has a công
 * đoạn. The server enforces all three (TreatmentService.Revise).
 */
export function useEditServiceRow(planId: string) {
  const [row, setRow] = useState<PlanDetailRow | null>(null);
  const [values, setValues] = useState<DraftServiceValues | null>(null);
  const [teethOpen, setTeethOpen] = useState(false);
  const update = useUpdateServiceLine();

  const stop = () => {
    setRow(null);
    setValues(null);
    setTeethOpen(false);
  };

  const save = async () => {
    if (!row || !values) return;
    if (values.quantity < 1) {
      toast.error(t("Treatment:Pricing:QuantityMin"));
      return;
    }
    try {
      await update.mutateAsync({
        planId,
        lineId: row.service.id,
        line: {
          price: values.price,
          quantity: values.quantity,
          teeth: toothValueToDtos(values.teeth),
          diagnosisId: values.diagnosisId,
          dentistId: values.dentistId,
          note: values.note.trim() || null,
          diagnoserStaffId: values.diagnoserStaffId,
          secondDiagnoserStaffId: values.secondDiagnoserStaffId,
          consultantStaffId: values.consultantStaffId,
          secondConsultantStaffId: values.secondConsultantStaffId,
        },
      });
      toast.success(t("Treatment:Service:UpdateServiceSuccess"));
      stop();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const inTreatment = row?.service.status === SERVICE_LINE_STATUS.InProgress;

  const controller: DraftServiceController | null =
    row && values
      ? {
          service: { id: row.service.serviceId, name: row.service.serviceName ?? row.service.code },
          values,
          update: (field, value) =>
            setValues((current) => (current ? { ...current, [field]: value } : current)),
          openTeeth: () => setTeethOpen(true),
          save: () => void save(),
          cancel: stop,
          saving: update.isPending,
          labels: {
            diagnosisId: row.service.diagnosisName ?? row.advise?.diagnosisName ?? null,
            dentistId: row.service.dentistName,
            diagnoserStaffId: row.service.diagnoserName,
            secondDiagnoserStaffId: row.service.secondDiagnoserName,
            consultantStaffId: row.service.consultantName,
            secondConsultantStaffId: row.service.secondConsultantName,
          },
          locks: inTreatment
            ? {
                diagnosisName: row.service.diagnosisName ?? row.advise?.diagnosisName ?? null,
                price: row.service.price,
              }
            : undefined,
        }
      : null;

  return {
    /** The line being edited, if any. */
    editingId: row?.service.id ?? null,
    controller,
    start: (next: PlanDetailRow) => {
      setRow(next);
      setValues(valuesOf(next));
    },
    stop,
    teethOpen,
    stagedTeeth: row?.service.stagedTeeth ?? [],
    confirmTeeth: (teeth: ToothPickerValue) => {
      setValues((current) => (current ? { ...current, teeth } : current));
      setTeethOpen(false);
    },
    closeTeeth: () => setTeethOpen(false),
  };
}
