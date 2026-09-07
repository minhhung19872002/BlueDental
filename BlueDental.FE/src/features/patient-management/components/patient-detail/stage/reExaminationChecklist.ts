import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";

/** One "Danh sách công đoạn" line, shaped for {@link StageStepList}. */
export interface ChecklistEntry {
  id: string;
  name: string;
}

/** The reference treats a lone em dash as no content at all. */
function trimmedContent(note: string | null | undefined): string {
  const text = note?.trim() ?? "";
  return text === "—" ? "" : text;
}

/**
 * "Danh sách công đoạn" on the tái khám screens.
 *
 * **Not** the service's steps, which is what the same heading means over on
 * "Chi tiết phiếu". The reference synthesises a single entry out of the
 * finished công đoạn's own Nội dung điều trị, keys it
 * `<stageId>-re-examination-stage`, and leaves the list empty — so the heading
 * prints "(Trống)" — when that content is blank.
 *
 * Read off the reference bundle 2026-09-07 (`stageChecklist: a ? [{ id:
 * `${e.id}-re-examination-stage`, label: a, checked: !1 }] : []`), which is why
 * the entry is always unticked to begin with. See
 * docs/clone/pages/patient-detail.md.
 */
export function reExaminationChecklist(stage: TreatmentStageDto | null): ChecklistEntry[] {
  const content = trimmedContent(stage?.note);
  if (!stage || !content) return [];
  return [{ id: `${stage.id}-re-examination-stage`, name: content }];
}
