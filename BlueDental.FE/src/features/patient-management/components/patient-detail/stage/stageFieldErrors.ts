import { t } from "@/lib/i18n";

/**
 * Field-level messages for the công đoạn forms, keyed by the field they sit
 * under.
 *
 * The reference reports these **beneath the field**, not as a toast: a toast
 * leaves you hunting for which of three inputs it meant, and it is gone by the
 * time you look. Shared by "Thêm/Tiếp tục công đoạn" and by the two follow-up
 * forms — the same three required fields in the same layout.
 */
export interface StageFieldErrors {
  staff?: string;
  note?: string;
  teeth?: string;
}

interface Draft {
  staffId: string | undefined;
  note: string;
  /** False reports "Vui lòng chọn răng"; pass true where teeth cannot be wrong. */
  teethPicked: boolean;
}

/**
 * Every empty required field at once, so the user is not made to press save
 * once per field to discover them one at a time.
 */
export function stageFieldErrors({ staffId, note, teethPicked }: Draft): StageFieldErrors {
  return {
    staff: staffId ? undefined : t("Vui lòng chọn bác sĩ"),
    note: note.trim() ? undefined : t("Vui lòng nhập nội dung điều trị"),
    teeth: teethPicked ? undefined : t("Vui lòng chọn răng"),
  };
}

export const hasStageFieldError = (errors: StageFieldErrors): boolean =>
  Boolean(errors.staff || errors.note || errors.teeth);
