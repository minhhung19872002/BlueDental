import { Button, Input, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import {
  useAssistantOptionsToday,
  useDentistOptionsToday,
} from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { FollowUpShots } from "./FollowUpShots";
import { FollowUpTeeth } from "./FollowUpTeeth";
import { StageDateField } from "./StageDateField";
import { NOTE_LIMIT } from "./StageForm";
import { StageNoteInput } from "./StageNoteInput";
import { StageStepList } from "./StageStepList";
import { useFollowUpForm } from "./useFollowUpForm";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  /** The finished công đoạn the tái khám is being raised against. */
  stage: TreatmentStageDto | null;
  onClose: () => void;
}

/**
 * "Tạo tái khám" — the follow-up a **finished** công đoạn offers: the stage
 * form's own layout, and a footer of Đóng plus a save.
 *
 * A tái khám is **not** a công đoạn — the reference's timeline returns it as a
 * row of its own, `type: "re_examination"` with code REX001 — so it goes to its
 * own resource and the source stage's `hasReExamination` flips. Measured
 * 2026-09-06 and 2026-09-07; see docs/clone/pages/patient-detail.md.
 *
 * "Tạo bảo hành" shared this dialog until P3110 (REQ-A9, G24) moved warranty
 * work to the slip's Bảo hành tab.
 */
export function StageFollowUpDialog({ open, patientId, branchId, plan, stage, onClose }: Props) {
  const form = useFollowUpForm({
    open,
    patientId,
    branchId,
    plan,
    stage,
    saved: "Patient:FollowUp:RecallSaved",
    onClose,
  });

  const { line } = form;

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className="pd-stage-dialog pd-recall-form-dialog"
      title={t("Patient:FollowUp:RecallTitle")}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Common:Close")}</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={form.saving}
            onClick={() => void form.save()}
          >
            {t("Patient:FollowUp:RecallSave")}
          </Button>
        </>
      }
      destroyOnHidden
    >
      <div className="pd-stage-form">
        <div>
          <StageDateField
            value={form.treatmentDate}
            error={form.errors.treatmentDate}
            onChange={form.setTreatmentDate}
          />
          <FloatingLabel label={t("Patient:Staff:Doctor")} required floated={Boolean(form.staffId)}>
            <ServerSearchSelect
              value={form.staffId}
              valueLabel={stage?.staffName}
              useOptions={useDentistOptionsToday}
              allowClear={false}
              onChange={(value) => form.setStaffId(value ?? "")}
            />
          </FloatingLabel>
          {form.errors.staff && <p className="pd-stage-error">{form.errors.staff}</p>}
          <FloatingLabel label={t("Patient:Staff:Assistant")} floated={Boolean(form.subStaffId)}>
            <ServerSearchSelect
              value={form.subStaffId}
              valueLabel={stage?.subStaffName}
              useOptions={useAssistantOptionsToday}
              onChange={form.setSubStaffId}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Patient:Staff:AssistingDoctor")} floated={Boolean(form.secondStaffId)}>
            <ServerSearchSelect
              value={form.secondStaffId}
              valueLabel={stage?.secondStaffName}
              useOptions={useDentistOptionsToday}
              onChange={form.setSecondStaffId}
            />
          </FloatingLabel>
        </div>

        <div>
          <FloatingLabel label={t("Patient:Misc:ServiceLabel")} floated>
            <Input
              disabled
              value={plan ? `${plan.code} - ${line?.serviceName ?? line?.code ?? ""}` : ""}
            />
          </FloatingLabel>
          <FollowUpTeeth
            candidates={form.candidates}
            picked={form.picked}
            onToggle={form.toggleTooth}
            onChange={form.changeTeeth}
          />
          {form.errors.teeth && <p className="pd-stage-error">{form.errors.teeth}</p>}
          <FollowUpShots
            files={form.pending}
            previews={form.previews}
            onAdd={form.addFiles}
            onRemove={form.removeFile}
          />
        </div>

        <div>
          <FloatingLabel label={t("Patient:Stage:TreatmentContent")} required floated={form.note.length > 0}>
            <StageNoteInput
              rows={5}
              value={form.note}
              maxLength={NOTE_LIMIT}
              onChange={form.setNote}
              status={form.errors.note ? "error" : undefined}
            />
          </FloatingLabel>
          {form.errors.note && <p className="pd-stage-error">{form.errors.note}</p>}
          {/* A tái khám carries the source công đoạn's content as its one
              tickable entry. */}
          <StageStepList
            steps={form.checklist}
            checked={form.pickedSteps}
            onChange={form.pickSteps}
          />
        </div>
      </div>
    </Modal>
  );
}
