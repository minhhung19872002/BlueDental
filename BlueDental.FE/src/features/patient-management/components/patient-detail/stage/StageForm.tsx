import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { StageContentColumn } from "./StageContentColumn";
import { StageImagesField } from "./StageImagesField";
import { StageRemarkColumn, type StageFormActions } from "./StageRemarkColumn";
import { StageStaffColumn } from "./StageStaffColumn";
import { StageTeethPicker } from "./StageTeethPicker";
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
  onPickImages: () => void;
}

interface Props {
  item: StageItem;
  draft: StageDraft;
  errors: StageFieldErrors;
  handlers: StageFormHandlers;
  actions?: StageFormActions;
}

/**
 * One công đoạn form — "Ngày - Nhân sự", "Dịch vụ đã chọn", "Nội dung điều
 * trị" and our own "Ghi chú lịch hẹn" (BA, 2026-10-27) side by side inside one
 * blue-bordered card. Several of them stack when several cards are picked.
 * A new warranty uses {@link StageWarrantyForm} instead.
 */
export function StageForm({ item, draft, errors, handlers, actions }: Props) {
  return (
    <div className="pd-stage-form pd-stage-form--four" data-item-id={item.id}>
      <StageStaffColumn draft={draft} errors={errors} onChange={handlers.onChange} />

      <div>
        <FloatingLabel label={t("Patient:Misc:ServiceLabel")} floated>
          <Input disabled value={item.line.serviceName ?? item.line.code} />
        </FloatingLabel>
        <StageTeethPicker
          candidates={item.teeth}
          shown={item.shownTeeth}
          picked={draft.teeth}
          locked={false}
          error={errors.teeth}
          onToggle={(code) => handlers.onChange({ teeth: toggleTooth(draft.teeth, code) })}
          onChange={(teeth) => handlers.onChange({ teeth: keepOffered(item, teeth) })}
        />
        {errors.teeth && <p className="pd-stage-error">{errors.teeth}</p>}
        <StageImagesField draft={draft} onChange={handlers.onChange} onPickImages={handlers.onPickImages} />
      </div>

      <StageContentColumn
        steps={item.line.serviceSteps ?? []}
        draft={draft}
        error={errors.note}
        onChange={handlers.onChange}
        onPickSteps={handlers.onPickSteps}
      />

      <StageRemarkColumn draft={draft} onChange={handlers.onChange} actions={actions} />
    </div>
  );
}
