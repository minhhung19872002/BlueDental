import { Button } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { StageAppointmentNote } from "./StageAppointmentNote";
import type { StageDraft } from "./stageDraft";

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
  draft: StageDraft;
  onChange: (patch: Partial<StageDraft>) => void;
  actions?: StageFormActions;
}

/** "Ghi chú lịch hẹn" (BA, 2026-10-27; R-1056), with the form's buttons under it. */
export function StageRemarkColumn({ draft, onChange, actions }: Props) {
  return (
    <div>
      <StageAppointmentNote
        value={draft.remark}
        treatmentDate={draft.treatmentDate}
        onChange={(remark) => onChange({ remark })}
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
  );
}
