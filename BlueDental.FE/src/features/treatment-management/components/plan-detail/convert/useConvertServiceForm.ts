import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toothSelectionsToValue, type ToothPickerValue } from "@/components/ToothChart";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  CONVERSION_TYPE,
  useConvertServiceLine,
  type ConversionType,
  type DifferenceHandling,
} from "../../../api/treatmentPlanApi";
import { EMPTY_TOOTH_VALUE, toothValueToDtos } from "../../plan/toothPicker";
import type { PlanDetailRow } from "../planDetailTypes";
import { asksAboutDifference, conversionMoney } from "./convertMoney";

export interface ConvertFormErrors {
  service?: string;
  note?: string;
  teeth?: string;
  difference?: string;
  diagnoser?: string;
  consultant?: string;
}

/**
 * State and rules of "Chuyển đổi dịch vụ".
 *
 * The dialog opens on the line being closed: its teeth, its diagnosing doctor
 * and its consultant are carried over, and "Thay thế" is picked for it.
 */
export function useConvertServiceForm(row: PlanDetailRow | null, onClose: () => void) {
  const convert = useConvertServiceLine();

  const [conversionType, setConversionType] = useState<ConversionType>(CONVERSION_TYPE.Replace);
  const [service, setService] = useState<CatalogOption | null>(null);
  const [charge, setCharge] = useState<number | null>(null);
  const [difference, setDifference] = useState<DifferenceHandling | null>(null);
  const [note, setNote] = useState("");
  const [teeth, setTeeth] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [teethOpen, setTeethOpen] = useState(false);
  const [diagnoserId, setDiagnoserId] = useState<string | null>(null);
  const [secondDiagnoserId, setSecondDiagnoserId] = useState<string | null>(null);
  const [consultantId, setConsultantId] = useState<string | null>(null);
  const [secondConsultantId, setSecondConsultantId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ConvertFormErrors>({});

  const line = row?.service ?? null;

  useEffect(() => {
    if (!line) return;

    setConversionType(CONVERSION_TYPE.Replace);
    setService(null);
    setCharge(null);
    setDifference(null);
    setNote("");
    setTeeth(toothSelectionsToValue(line.teeth));
    setDiagnoserId(line.diagnoserStaffId);
    setSecondDiagnoserId(line.secondDiagnoserStaffId);
    setConsultantId(line.consultantStaffId);
    setSecondConsultantId(line.secondConsultantStaffId);
    setErrors({});
  }, [line]);

  const toothDtos = useMemo(() => toothValueToDtos(teeth), [teeth]);
  const replacing = conversionType === CONVERSION_TYPE.Replace;
  const hasNewService = replacing ? service !== null : line !== null;

  // Dịch vụ cũ keeps the price the line was sold at; Thay thế takes the new
  // service's list price.
  const unitPrice = replacing ? (service?.price ?? 0) : (line?.price ?? 0);
  const money = conversionMoney({
    unitPrice,
    quantity: Math.max(toothDtos.length, 1),
    charge,
    oldPaid: line?.paidAmount ?? 0,
  });
  const showDifference = asksAboutDifference(hasNewService, money);

  const validate = (): boolean => {
    const next: ConvertFormErrors = {};
    if (replacing && !service) next.service = t("Treatment:Convert:SelectServiceRequired");
    if (!note.trim()) next.note = t("Treatment:Refund:NoteRequired");
    if (toothDtos.length === 0) next.teeth = t("Treatment:Convert:ToothRequired");
    if (showDifference && difference === null) next.difference = t("Treatment:Refund:DifferenceRequired");
    if (!diagnoserId) next.diagnoser = t("Treatment:Diagnosis:DiagnoserRequired");
    if (!consultantId) next.consultant = t("Treatment:Consulting:AdvisorRequired");
    if (diagnoserId && secondDiagnoserId === diagnoserId)
      next.diagnoser = t("Treatment:Diagnosis:DiagnoserDuplicate");
    if (consultantId && secondConsultantId === consultantId)
      next.consultant = t("Treatment:Consulting:AdvisorDuplicate");

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!row || !validate()) return;

    try {
      await convert.mutateAsync({
        planId: row.plan.id,
        lineId: row.service.id,
        body: {
          conversionType,
          serviceId: replacing ? (service?.id ?? null) : null,
          paymentAmount: charge,
          differenceHandling: showDifference ? difference : null,
          note: note.trim(),
          teeth: toothDtos,
          diagnoserStaffId: diagnoserId,
          secondDiagnoserStaffId: secondDiagnoserId,
          consultantStaffId: consultantId,
          secondConsultantStaffId: secondConsultantId,
        },
      });
      toast.success(t("Treatment:Convert:ConvertSuccess"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return {
    line,
    conversionType,
    setConversionType,
    service,
    setService,
    charge,
    setCharge,
    difference,
    setDifference,
    note,
    setNote,
    teeth,
    teethOpen,
    openTeeth: () => setTeethOpen(true),
    closeTeeth: () => setTeethOpen(false),
    confirmTeeth: (value: ToothPickerValue) => {
      setTeeth(value);
      setTeethOpen(false);
    },
    diagnoserId,
    setDiagnoserId,
    secondDiagnoserId,
    setSecondDiagnoserId,
    consultantId,
    setConsultantId,
    secondConsultantId,
    setSecondConsultantId,
    money,
    showDifference,
    replacing,
    errors,
    saving: convert.isPending,
    save,
  };
}
