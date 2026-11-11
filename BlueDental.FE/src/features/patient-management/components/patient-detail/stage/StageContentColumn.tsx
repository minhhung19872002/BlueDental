import type { ReactNode } from "react";
import { FloatingLabel } from "@/components/FloatingLabel";
import type { ServiceStepDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { StageNoteInput } from "./StageNoteInput";
import { StageStepList } from "./StageStepList";
import type { StageDraft } from "./stageDraft";

/** The reference caps Nội dung điều trị at 1000 characters. */
export const NOTE_LIMIT = 1000;

interface Props {
  /** The service's "Danh sách công đoạn". */
  steps: ServiceStepDto[];
  draft: StageDraft;
  error?: string;
  onChange: (patch: Partial<StageDraft>) => void;
  /** Every step id ticked after a change — one box, or the "Chọn tất cả" box. */
  onPickSteps: (stepIds: string[]) => void;
  /** Shown in the empty box; when given, the label stays up so it can show. */
  placeholder?: string;
  /** What goes above Nội dung điều trị — the Răng line, a warranty form's card and Labo pick. */
  children?: ReactNode;
}

/**
 * "Nội dung điều trị": the note, then which of the service's steps this công
 * đoạn will cover. The steps save unticked — the history row is where they get
 * ticked off. It takes two cells of the form, the one "Dịch vụ đã chọn" had
 * among them (owner, 2026-11-11, R-1206).
 */
export function StageContentColumn({ steps, draft, error, onChange, onPickSteps, placeholder, children }: Props) {
  return (
    <div className="pd-stage-content">
      {children}
      <FloatingLabel
        label={t("Patient:Stage:TreatmentContent")}
        required
        floated={Boolean(placeholder) || draft.note.length > 0}
      >
        <StageNoteInput
          rows={5}
          value={draft.note}
          maxLength={NOTE_LIMIT}
          placeholder={placeholder}
          onChange={(note) => onChange({ note })}
          status={error ? "error" : undefined}
        />
      </FloatingLabel>
      {error && <p className="pd-stage-error">{error}</p>}
      <StageStepList steps={steps} checked={draft.steps} onChange={onPickSteps} />
    </div>
  );
}
