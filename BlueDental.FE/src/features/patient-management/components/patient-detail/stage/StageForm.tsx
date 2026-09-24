import { useEffect, useMemo } from "react";
import { Button, Input } from "antd";
import { PictureOutlined, SaveOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import {
  useAssistantOptionsSearch,
  useDentistOptions,
} from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { StageShots } from "./StageShots";
import { StageStepList } from "./StageStepList";
import { StageTeethPicker } from "./StageTeethPicker";
import type { StageDraft } from "./stageDraft";
import type { StageFieldErrors } from "./stageFieldErrors";
import type { StageItem } from "./stageModel";

/** The reference caps Nội dung điều trị at 1000 characters. */
export const NOTE_LIMIT = 1000;

/** How the form talks back to the dialog; one draft per form. */
export interface StageFormHandlers {
  onChange: (patch: Partial<StageDraft>) => void;
  onToggleStep: (stepId: string, next: boolean) => void;
  onPickImages: () => void;
}

/**
 * Hủy and the save button. The reference draws them under the **last** open
 * form only — one press saves every open form at once.
 */
export interface StageFormActions {
  primaryLabel: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

interface Props {
  item: StageItem;
  draft: StageDraft;
  errors: StageFieldErrors;
  handlers: StageFormHandlers;
  actions?: StageFormActions;
}

/**
 * Blob previews for the chosen files, revoked when the list changes or the form
 * goes — minting them in the render would hand out a fresh URL on every
 * keystroke and never release one.
 */
function usePreviews(files: File[]): string[] {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  return previews;
}

/**
 * One công đoạn form — "Ngày - Nhân sự", "Dịch vụ đã chọn" and "Nội dung điều
 * trị" side by side inside one blue-bordered card, as the reference draws it.
 * Several of them stack when several cards are picked.
 */
export function StageForm({ item, draft, errors, handlers, actions }: Props) {
  const previews = usePreviews(draft.pending);
  const locked = item.tab !== "add";

  return (
    <div className="pd-stage-form" data-item-id={item.id}>
      <div>
        <FloatingLabel label={t("Patient:Col:CreatedAt")} floated>
          <Input disabled value={formatDate(new Date().toISOString())} />
        </FloatingLabel>
        <FloatingLabel label={t("Patient:Staff:Doctor")} floated={Boolean(draft.staffId)}>
          <ServerSearchSelect
            value={draft.staffId}
            valueLabel={draft.labels.staff}
            useOptions={useDentistOptions}
            allowClear={false}
            onChange={(value) => handlers.onChange({ staffId: value ?? undefined })}
          />
        </FloatingLabel>
        {errors.staff && <p className="pd-stage-error">{errors.staff}</p>}
        <FloatingLabel label={t("Patient:Staff:Assistant")} floated={Boolean(draft.subStaffId)}>
          <ServerSearchSelect
            value={draft.subStaffId}
            valueLabel={draft.labels.subStaff}
            useOptions={useAssistantOptionsSearch}
            onChange={(value) => handlers.onChange({ subStaffId: value })}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Patient:Staff:AssistingDoctor")} floated={Boolean(draft.secondStaffId)}>
          <ServerSearchSelect
            value={draft.secondStaffId}
            valueLabel={draft.labels.secondStaff}
            useOptions={useDentistOptions}
            onChange={(value) => handlers.onChange({ secondStaffId: value })}
          />
        </FloatingLabel>
      </div>

      <div>
        <FloatingLabel label={t("Patient:Misc:ServiceLabel")} floated>
          <Input disabled value={item.line.serviceName ?? item.line.code} />
        </FloatingLabel>
        <StageTeethPicker
          candidates={item.teeth}
          picked={draft.teeth}
          locked={locked}
          error={errors.teeth}
          onChange={(teeth) => handlers.onChange({ teeth })}
        />
        {errors.teeth && <p className="pd-stage-error">{errors.teeth}</p>}
        <div className="pd-stage-images">
          <p>{t("Patient:Tab:Images")}:</p>
          <p>
            {draft.pending.length === 0
              ? t("Patient:QuoteSheet:Empty")
              : t("Patient:Stage:PhotosSelected", draft.pending.length)}
          </p>
        </div>
        <StageShots
          files={draft.pending}
          previews={previews}
          onRemove={(at) =>
            handlers.onChange({ pending: draft.pending.filter((_, index) => index !== at) })
          }
        />
        <Button block icon={<PictureOutlined />} onClick={handlers.onPickImages}>
          {t("Patient:Photo:UploadButton")}
        </Button>
      </div>

      <div>
        <FloatingLabel label={t("Patient:Stage:TreatmentContent")} floated={draft.note.length > 0}>
          <Input.TextArea
            rows={5}
            value={draft.note}
            maxLength={NOTE_LIMIT}
            onChange={(event) => handlers.onChange({ note: event.target.value })}
            status={errors.note ? "error" : undefined}
          />
        </FloatingLabel>
        {errors.note && <p className="pd-stage-error">{errors.note}</p>}
        {/* Which of the service's steps this công đoạn will cover. They save
            unticked — the history row is where they get ticked off. */}
        <StageStepList
          steps={item.line.serviceSteps ?? []}
          checked={draft.steps}
          onToggle={handlers.onToggleStep}
        />
        {actions && (
          <div className="pd-stage-formactions">
            <Button onClick={actions.onCancel}>{t("Patient:Misc:Cancel")}</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={actions.saving} onClick={actions.onSave}>
              {actions.primaryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
