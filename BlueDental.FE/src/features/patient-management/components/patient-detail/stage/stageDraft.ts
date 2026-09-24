import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
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
 * - **continue** — the công đoạn's own doctor, Phụ tá and Bác sĩ hỗ trợ, and its
 *   teeth, which stay locked.
 *
 * Nội dung điều trị always starts blank: it is this visit's note, not the last.
 */
export function initialDraft(
  item: StageItem,
  newestOfLine: TreatmentStageDto | undefined,
  fallback: StaffFallback | null,
): StageDraft {
  const base = { note: "", pending: [], steps: [], teeth: toothCodes(item.teeth) };

  if (item.stage) {
    return {
      ...base,
      staffId: item.stage.staffId,
      subStaffId: item.stage.subStaffId ?? undefined,
      secondStaffId: item.stage.secondStaffId ?? undefined,
      labels: {
        staff: item.stage.staffName,
        subStaff: item.stage.subStaffName,
        secondStaff: item.stage.secondStaffName,
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
  const errors = stageFieldErrors({
    staffId: draft.staffId,
    note: draft.note,
    teethPicked: item.teeth.length === 0 || draft.teeth.length > 0,
  });
  return hasStageFieldError(errors) ? errors : null;
}
