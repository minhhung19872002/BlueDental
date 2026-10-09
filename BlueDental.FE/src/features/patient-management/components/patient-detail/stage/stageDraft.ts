import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import { t } from "@/lib/i18n";
import { todayIsoDate } from "@/utils/todayIsoDate";
import { toothCodes, type StageItem } from "./stageModel";
import { hasStageFieldError, stageFieldErrors, type StageFieldErrors } from "./stageFieldErrors";

/** What one open form holds until it is saved. */
export interface StageDraft {
  staffId: string | undefined;
  /** Phụ tá — the reference's `subStaffId`. */
  subStaffId: string | undefined;
  /** Bác sĩ hỗ trợ — the reference's `assistantStaffId`. */
  secondStaffId: string | undefined;
  note: string;
  /**
   * Ngày điều trị, "YYYY-MM-DD" — today unless the doctor picks an earlier day;
   * never a later one (BA, 2026-10-09). Empty once the picker is cleared.
   */
  treatmentDate: string;
  /** Pictures chosen before the công đoạn exists; attached once it is saved. */
  pending: File[];
  /** Step ids ticked under "Danh sách công đoạn". */
  steps: string[];
  /** Tooth codes the công đoạn will take. */
  teeth: number[];
  /**
   * Names for the people the form started with, so a picker whose first page
   * does not hold them still prints a name rather than an id.
   */
  labels: {
    staff: string | null;
    subStaff: string | null;
    secondStaff: string | null;
  };
}

/** Someone the form may fall back on for Bác sĩ. */
export interface StaffFallback {
  id: string;
  name: string | null;
}

/**
 * A form's starting point, as the reference seeds it:
 *
 * - **add** — the doctor of the line's newest công đoạn, else the line's own
 *   (the reference's order), else the slip's; every free tooth picked, so the
 *   common case of taking them all is one click;
 * - **continue** — the doctor, Phụ tá and Bác sĩ hỗ trợ of the newest open công
 *   đoạn, and every tooth still open, any of which can be dropped one by one.
 *
 * Nội dung điều trị always starts blank: it is this visit's note, not the last.
 */
export function initialDraft(
  item: StageItem,
  newestOfLine: TreatmentStageDto | undefined,
  fallback: StaffFallback | null,
): StageDraft {
  const base = {
    note: "",
    treatmentDate: todayIsoDate(),
    pending: [],
    steps: [],
    teeth: toothCodes(item.teeth),
  };

  const [stage] = item.stages;
  if (stage) {
    return {
      ...base,
      staffId: stage.staffId,
      subStaffId: stage.subStaffId ?? undefined,
      secondStaffId: stage.secondStaffId ?? undefined,
      labels: {
        staff: stage.staffName,
        subStaff: stage.subStaffName,
        secondStaff: stage.secondStaffName,
      },
    };
  }

  const doctor: StaffFallback | null = newestOfLine
    ? { id: newestOfLine.staffId, name: newestOfLine.staffName }
    : item.line.dentistId
      ? { id: item.line.dentistId, name: item.line.dentistName }
      : fallback;

  return {
    ...base,
    staffId: doctor?.id,
    subStaffId: undefined,
    secondStaffId: undefined,
    labels: { staff: doctor?.name ?? null, subStaff: null, secondStaff: null },
  };
}

/**
 * Drops a starting name the matching picker would not offer — a Bác sĩ not
 * ticked "Bác sĩ", a Phụ tá ticked neither "Phụ tá" nor "Y sĩ", or someone OFF
 * today — so the form asks instead of carrying it in (owner, 2026-10-05).
 * A pool still loading keeps the draft as it is.
 */
export function keepEligibleStaff(
  draft: StageDraft,
  dentists: ReadonlySet<string> | undefined,
  assistants: ReadonlySet<string> | undefined,
): StageDraft {
  const fits = (id: string | undefined, pool: ReadonlySet<string> | undefined) =>
    !id || !pool || pool.has(id);
  const staffOk = fits(draft.staffId, dentists);
  const subOk = fits(draft.subStaffId, assistants);
  const secondOk = fits(draft.secondStaffId, dentists);
  if (staffOk && subOk && secondOk) return draft;

  return {
    ...draft,
    staffId: staffOk ? draft.staffId : undefined,
    subStaffId: subOk ? draft.subStaffId : undefined,
    secondStaffId: secondOk ? draft.secondStaffId : undefined,
    labels: {
      staff: staffOk ? draft.labels.staff : null,
      subStaff: subOk ? draft.labels.subStaff : null,
      secondStaff: secondOk ? draft.labels.secondStaff : null,
    },
  };
}

/** Whether closing now would throw this form's work away — see the dialog. */
export const isDraftDirty = (draft: StageDraft): boolean =>
  draft.note.trim().length > 0 || draft.pending.length > 0;

/**
 * The reference's schema for every form it saves (`validateStageModalItems`):
 * doctor, at least one tooth and the treatment note, each reported under its
 * own field. The note's 1000-character cap is the textarea's own.
 *
 * A line that names no teeth (a whole-mouth service) has none to pick, so the
 * tooth rule only holds where the card offers some — the server skips the
 * check for such a line too (StageTeethPolicy.EnsureNewStageTeeth).
 */
export function draftErrors(draft: StageDraft, item: StageItem): StageFieldErrors | null {
  const errors: StageFieldErrors = {
    ...stageFieldErrors({
      staffId: draft.staffId,
      note: draft.note,
      teethPicked: item.teeth.length === 0 || draft.teeth.length > 0,
    }),
    treatmentDate: draft.treatmentDate ? undefined : t("Patient:Stage:RequiredTreatmentDate"),
  };
  return hasStageFieldError(errors) ? errors : null;
}
