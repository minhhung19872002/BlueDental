import { Button, Input, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useStaffOptionsSearch } from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { FollowUpShots } from "./FollowUpShots";
import { FollowUpTeeth } from "./FollowUpTeeth";
import { StageStepList } from "./StageStepList";
import { useFollowUpForm } from "./useFollowUpForm";

/** What the finished công đoạn is being followed up with. */
export type FollowUpKind = "guarantee" | "reExamination";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  /** The finished công đoạn the follow-up is being raised against. */
  stage: TreatmentStageDto | null;
  kind: FollowUpKind;
  onClose: () => void;
}

const KIND = {
  guarantee: {
    title: "Patient:FollowUp:WarrantyTitle",
    save: "Patient:FollowUp:WarrantySave",
    saved: "Patient:FollowUp:WarrantySaved",
    className: "pd-warranty-dialog",
    /** A warranty visit inherits the công đoạn's teeth as they stand. */
    pickTeeth: false,
    /** The reference builds no "Danh sách công đoạn" for a warranty visit. */
    checklist: false,
  },
  reExamination: {
    title: "Patient:FollowUp:RecallTitle",
    save: "Patient:FollowUp:RecallSave",
    saved: "Patient:FollowUp:RecallSaved",
    className: "pd-recall-form-dialog",
    /** A tái khám is only for the teeth being seen again — see FollowUpTeeth. */
    pickTeeth: true,
    checklist: true,
  },
} as const;

/**
 * "Tạo bảo hành" and "Tạo tái khám" — the two follow-ups a **finished** công
 * đoạn offers. One component because the reference draws them identically: the
 * stage form's own layout, and a footer of Đóng plus a save.
 *
 * What they write differs, and that fork lives in {@link useFollowUpForm}: a
 * warranty visit is another công đoạn on the same line flagged `isGuarantee`,
 * while a tái khám is **not** a công đoạn at all — the reference's timeline
 * returns it as a row of its own, `type: "re_examination"` with code REX001 —
 * so it goes to its own resource and the source stage's `hasReExamination`
 * flips. Measured 2026-09-06 and 2026-09-07; see
 * docs/clone/pages/patient-detail.md.
 */
export function StageFollowUpDialog({
  open,
  patientId,
  branchId,
  plan,
  stage,
  kind,
  onClose,
}: Props) {
  const copy = KIND[kind];
  const form = useFollowUpForm({
    open,
    patientId,
    branchId,
    plan,
    stage,
    pickTeeth: copy.pickTeeth,
    saved: copy.saved,
    onClose,
  });

  const { line } = form;

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className={`pd-stage-dialog ${copy.className}`}
      title={t(copy.title)}
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
            {t(copy.save)}
          </Button>
        </>
      }
      destroyOnHidden
    >
      <div className="pd-stage-form">
        <div>
          <FloatingLabel label={t("Patient:Col:CreatedAt")} floated>
            <Input disabled value={formatDate(new Date().toISOString())} />
          </FloatingLabel>
          <FloatingLabel label={t("Patient:Staff:Doctor")} floated={Boolean(form.staffId)}>
            <ServerSearchSelect
              value={form.staffId}
              useOptions={useStaffOptionsSearch}
              allowClear={false}
              onChange={(value) => form.setStaffId(value ?? "")}
            />
          </FloatingLabel>
          {form.errors.staff && <p className="pd-stage-error">{form.errors.staff}</p>}
          <FloatingLabel label={t("Patient:Staff:Assistant")} floated={Boolean(form.subStaffId)}>
            <ServerSearchSelect
              value={form.subStaffId}
              useOptions={useStaffOptionsSearch}
              onChange={form.setSubStaffId}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Patient:Staff:AssistingDoctor")} floated={Boolean(form.secondStaffId)}>
            <ServerSearchSelect
              value={form.secondStaffId}
              useOptions={useStaffOptionsSearch}
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
            onToggle={copy.pickTeeth ? form.toggleTooth : undefined}
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
          <FloatingLabel label={t("Patient:Stage:TreatmentContent")} floated={form.note.length > 0}>
            <Input.TextArea
              rows={5}
              value={form.note}
              maxLength={1000}
              onChange={(event) => form.setNote(event.target.value)}
              status={form.errors.note ? "error" : undefined}
            />
          </FloatingLabel>
          {form.errors.note && <p className="pd-stage-error">{form.errors.note}</p>}
          {/* A tái khám carries the source công đoạn's content as its one
              tickable entry; a warranty visit builds no checklist at all, so
              the heading prints "(Trống)". */}
          <StageStepList
            steps={copy.checklist ? form.checklist : []}
            checked={form.pickedSteps}
            onToggle={copy.checklist ? form.toggleStep : undefined}
          />
        </div>
      </div>
    </Modal>
  );
}
