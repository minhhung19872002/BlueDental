import { useState } from "react";
import { Button, Input } from "antd";
import { t } from "@/lib/i18n";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import { StageEditPencil } from "./StageEditPencil";

/** TreatmentStage.RemarkMaxLength on the server. */
export const REMARK_LIMIT = 1000;

interface Props {
  stage: TreatmentStageDto;
  saving: boolean;
  /** treatmentStage.update — without it the cell only reads. */
  editable: boolean;
  /** Resolves true once saved; a refused save keeps the editor and its draft. */
  onSave: (remark: string) => Promise<boolean>;
}

/**
 * Ghi chú — a free remark beside Nội dung điều trị (owner, 2026-10-19). Plain
 * text with its line breaks kept, no dash bullets. Unlike the content it stays
 * open once the công đoạn is finished; only a continued one is shut.
 */
export function StageRemarkCell({ stage, saving, editable, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  const handleSave = async () => {
    if (draft === null) return;
    if (await onSave(draft)) setDraft(null);
  };

  return (
    <div className="pd-stage-remark">
      <div className="pd-stage-notebar">
        {editable && !editing && !stage.isSuperseded && (
          <StageEditPencil
            label={t("Patient:Stage:EditRemark")}
            onClick={() => setDraft(stage.remark ?? "")}
          />
        )}
      </div>

      {editing ? (
        <div className="pd-stage-noteedit">
          <Input.TextArea
            autoFocus
            rows={4}
            value={draft}
            maxLength={REMARK_LIMIT}
            showCount
            placeholder={t("Patient:Stage:RemarkPlaceholder")}
            aria-label={t("Patient:Stage:Remark")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <Button disabled={saving} onClick={() => setDraft(null)}>
              {t("Patient:Misc:Cancel")}
            </Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {t("Patient:Misc:Save")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="pd-stage-remarktext">{stage.remark}</p>
      )}
    </div>
  );
}
