import { FloatingLabel } from "@/components/FloatingLabel";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useAssistantOptionsToday, useDentistOptionsToday } from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";
import { rebasePick } from "./appointmentNote";
import { StageDateField } from "./StageDateField";
import type { StageDraft } from "./stageDraft";
import type { StageFieldErrors } from "./stageFieldErrors";

interface Props {
  draft: StageDraft;
  errors: StageFieldErrors;
  onChange: (patch: Partial<StageDraft>) => void;
}

/**
 * "Ngày - Nhân sự": Ngày điều trị, which the doctor picks (the creation date is
 * kept server-side for tracking only — BA, 2026-10-09), Bác sĩ, Phụ tá and Bác
 * sĩ hỗ trợ. Shared by every công đoạn form, the warranty one included
 * (P3110 REQ-F2).
 */
export function StageStaffColumn({ draft, errors, onChange }: Props) {
  return (
    <div>
      <StageDateField
        value={draft.treatmentDate}
        error={errors.treatmentDate}
        onChange={(treatmentDate) =>
          onChange({
            treatmentDate,
            remark: rebasePick(draft.remark, draft.treatmentDate, treatmentDate),
          })
        }
      />
      <FloatingLabel label={t("Patient:Staff:Doctor")} required floated={Boolean(draft.staffId)}>
        <ServerSearchSelect
          value={draft.staffId}
          valueLabel={draft.labels.staff}
          useOptions={useDentistOptionsToday}
          allowClear={false}
          onChange={(value) => onChange({ staffId: value ?? undefined })}
        />
      </FloatingLabel>
      {errors.staff && <p className="pd-stage-error">{errors.staff}</p>}
      <FloatingLabel label={t("Patient:Staff:Assistant")} floated={Boolean(draft.subStaffId)}>
        <ServerSearchSelect
          value={draft.subStaffId}
          valueLabel={draft.labels.subStaff}
          useOptions={useAssistantOptionsToday}
          onChange={(value) => onChange({ subStaffId: value })}
        />
      </FloatingLabel>
      <FloatingLabel label={t("Patient:Staff:AssistingDoctor")} floated={Boolean(draft.secondStaffId)}>
        <ServerSearchSelect
          value={draft.secondStaffId}
          valueLabel={draft.labels.secondStaff}
          useOptions={useDentistOptionsToday}
          onChange={(value) => onChange({ secondStaffId: value })}
        />
      </FloatingLabel>
    </div>
  );
}
