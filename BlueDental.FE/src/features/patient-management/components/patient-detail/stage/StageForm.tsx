import { StageContentColumn } from "./StageContentColumn";
import { StageRemarkColumn, type StageFormActions } from "./StageRemarkColumn";
import { StageStaffColumn } from "./StageStaffColumn";
import { StageTeethRow } from "./StageTeethRow";
import type { StageDraft } from "./stageDraft";
import type { StageFieldErrors } from "./stageFieldErrors";
import { keepOffered, toggleTooth, type StageItem } from "./stageModel";

export { NOTE_LIMIT } from "./StageContentColumn";
export type { StageFormActions } from "./StageRemarkColumn";

/** How the form talks back to the dialog; one draft per form. */
export interface StageFormHandlers {
  onChange: (patch: Partial<StageDraft>) => void;
  /** Every step id ticked after a change — one box, or the "Chọn tất cả" box. */
  onPickSteps: (stepIds: string[]) => void;
}

interface Props {
  item: StageItem;
  draft: StageDraft;
  errors: StageFieldErrors;
  handlers: StageFormHandlers;
  actions?: StageFormActions;
}

/**
 * One công đoạn form — "Ngày - Nhân sự", "Nội dung điều trị" over two cells
 * with the Răng line at its head, and our own "Ghi chú lịch hẹn" (BA,
 * 2026-10-27) side by side inside one blue-bordered card. Several of them stack
 * when several cards are picked. The owner dropped "Dịch vụ đã chọn" — the
 * service field, the tooth grid and Hình ảnh — on 2026-11-11 (R-1206): the
 * service is on its card, pictures go on from the history row.
 * A new warranty uses {@link StageWarrantyForm} instead.
 */
export function StageForm({ item, draft, errors, handlers, actions }: Props) {
  return (
    <div className="pd-stage-form pd-stage-form--four" data-item-id={item.id}>
      <StageStaffColumn draft={draft} errors={errors} onChange={handlers.onChange} />

      <StageContentColumn
        steps={item.line.serviceSteps ?? []}
        draft={draft}
        error={errors.note}
        onChange={handlers.onChange}
        onPickSteps={handlers.onPickSteps}
      >
        <StageTeethRow
          candidates={item.teeth}
          shown={item.shownTeeth}
          picked={draft.teeth}
          error={errors.teeth}
          onToggle={(code) => handlers.onChange({ teeth: toggleTooth(draft.teeth, code) })}
          onChange={(teeth) => handlers.onChange({ teeth: keepOffered(item, teeth) })}
        />
      </StageContentColumn>

      <StageRemarkColumn draft={draft} onChange={handlers.onChange} actions={actions} />
    </div>
  );
}
