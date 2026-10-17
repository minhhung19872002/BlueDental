import { t } from "@/lib/i18n";
import {
  RECORD_SET_STATUS,
  SLIP_STATUS,
  type RecordSetDto,
  type RecordSetPlanDto,
} from "../../../api/medicalRecordSetApi";

/** How the record sets read a treatment slip and a set. Pure functions, no API. */

export type SlipPillTone = "created" | "progress" | "done" | "cancelled";

/**
 * "Trạng thái phiếu" — the labels Kế hoạch điều trị already uses for a slip, so
 * the two screens never disagree: "Đã tạo" is what the clinic calls chưa điều trị.
 */
export function slipPill(plan: RecordSetPlanDto): { label: string; tone: SlipPillTone } {
  if (plan.planStatus === SLIP_STATUS.Cancelled)
    return { label: t("Patient:MedRecord:StatusCancelled"), tone: "cancelled" };
  if (plan.planStatus === SLIP_STATUS.Completed)
    return { label: t("Treatment:Plan:StatusCompleted"), tone: "done" };
  if (plan.notStarted) return { label: t("Treatment:Plan:StatusCreated"), tone: "created" };
  return { label: t("Treatment:Plan:StatusInProgress"), tone: "progress" };
}

export const isCancelledSet = (set: RecordSetDto) => set.status === RECORD_SET_STATUS.Cancelled;

/** The slip a set is summed up by: the newest one (the API lists them newest first). */
export const representativeOf = (set: RecordSetDto): RecordSetPlanDto | undefined => set.plans[0];

/** "{Mã phiếu chẩn đoán} - {Mã phiếu điều trị}" under the set's code. */
export function setCodesLine(set: RecordSetDto): string {
  const plan = representativeOf(set);
  if (!plan) return t("Patient:RecordSet:NoSlip");
  return [plan.diagnosisSlipCode, plan.planCode].filter(Boolean).join(" - ");
}

/** A set in the list shows only the diagnosis name of its newest slip. */
export function setDiagnosisLine(set: RecordSetDto): string {
  const plan = representativeOf(set);
  if (!plan) return t("Patient:RecordSet:NoSlip");
  return plan.diagnosisName ?? plan.treatmentName ?? plan.planCode;
}

/**
 * Whether a slip can be ticked or unticked in the dialog of `setId` (null for a
 * new set). The clinic's rule (owner, 2026-10-17):
 * - a free slip may be ticked into any set;
 * - a slip of this set may be unticked while it is still "chưa điều trị";
 * - a slip another set holds is locked, in the create and the edit view alike —
 *   it is taken out of that set first;
 * - a cancelled slip joins nothing.
 */
export function canToggleSlip(plan: RecordSetPlanDto, setId: string | null): boolean {
  if (plan.planStatus === SLIP_STATUS.Cancelled) return false;
  if (plan.recordSetId === null) return true;
  return plan.recordSetId === setId && plan.notStarted;
}

/** Why a slip cannot be ticked, for the lock's tooltip. */
export function lockReason(plan: RecordSetPlanDto, setId: string | null): string {
  if (plan.planStatus === SLIP_STATUS.Cancelled) return t("Patient:RecordSet:CancelledSlipHint");
  if (plan.recordSetId !== setId) return t("Patient:RecordSet:TakenHint");
  return t("Patient:RecordSet:LockedHint");
}

/** "dd/MM/yyyy" or "dd/MM/yyyy HH:mm" in the browser's own clock, as the rest of the record does. */
export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
  return withTime ? `${day} ${pad(at.getHours())}:${pad(at.getMinutes())}` : day;
}
