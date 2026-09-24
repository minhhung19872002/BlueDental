import { useState } from "react";
import { Button, Modal } from "antd";
import { DollarOutlined, PrinterOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LaboOrderDialog } from "./stage/LaboOrderDialog";
import { StageForm } from "./stage/StageForm";
import { StageHistory } from "./stage/StageHistory";
import { StagePicks } from "./stage/StagePicks";
import { TreatmentHistoryPrintDialog } from "./stage/TreatmentHistoryPrintDialog";
import { StageFollowUpDialog } from "./stage/StageFollowUpDialog";
import { STAGE_TABS, type StageTab } from "./stage/stageModel";
import { useStageComposer } from "./stage/useStageComposer";

interface Props {
  open: boolean;
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
  /** The slip the clicked row belongs to. */
  plan: TreatmentPlanSlipDto | null;
  /** The line of the row that was clicked. */
  focusServiceId: string | null;
  /** The công đoạn of that row — the dialog lands on the tab its work is in. */
  focusStageId?: string | null;
  onClose: () => void;
  /**
   * "Thanh toán" — the reference leaves the dialog for the slip's Kế hoạch
   * điều trị screen rather than opening a payment form here.
   */
  onOpenPlan: () => void;
}

/** i18n keys per tab: its caption, what an empty tab says, its save button. */
const TAB_COPY: Record<StageTab, { label: string; empty: string; save: string }> = {
  add: { label: "Patient:Stage:AddLabel", empty: "Patient:Stage:EmptyAdd", save: "Patient:Stage:SaveStage" },
  continue: {
    label: "Patient:Stage:ContinueLabel",
    empty: "Patient:Stage:EmptyContinue",
    save: "Patient:Stage:Continue",
  },
  continueWarranty: {
    label: "Patient:Stage:ContinueWarrantyLabel",
    empty: "Patient:Stage:EmptyContinueWarranty",
    save: "Patient:Stage:ContinueWarranty",
  },
};

/** "Ngày - Nhân sự" · "Dịch vụ đã chọn" · "Nội dung điều trị". */
function ColumnHead({ children }: { children: string }) {
  return <div className="pd-stage-colhead">{children}</div>;
}

/**
 * "Chi tiết phiếu" — the dialog behind the treatment table's Công đoạn cell.
 *
 * Laid out from the reference's own dialog: three tabs (THÊM CÔNG ĐOẠN, TIẾP
 * TỤC CÔNG ĐOẠN, TIẾP TỤC BẢO HÀNH), the tab's cards on the left — any number
 * of them open at once, each with its own form — and the slip's whole "Lịch sử
 * điều trị" underneath. Everything it reads and writes lives in
 * {@link useStageComposer}. See docs/clone/pages/patient-detail.md.
 */
export function TreatmentStageDialog({
  open,
  patientId,
  patientCode,
  patientName,
  branchId,
  plan,
  focusServiceId,
  focusStageId = null,
  onClose,
  onOpenPlan,
}: Props) {
  const branch = useBranchInfo(branchId);
  const composer = useStageComposer({ open, patientId, branchId, plan, focusServiceId, focusStageId });

  const [printing, setPrinting] = useState(false);
  const [laboStage, setLaboStage] = useState<TreatmentStageDto | null>(null);
  const [warrantyStage, setWarrantyStage] = useState<TreatmentStageDto | null>(null);
  const [discarding, setDiscarding] = useState(false);

  /**
   * Leaving with something written asks first. The reference hangs one guarded
   * close off both the ✕ and the form's "Hủy", so "Hủy" leaves the whole
   * "Chi tiết phiếu" — it does not just drop the picked cards.
   */
  const requestClose = () => {
    if (composer.dirty) setDiscarding(true);
    else onClose();
  };

  const last = composer.chosen[composer.chosen.length - 1];

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className="pd-stage-dialog"
      title={t("Patient:Stage:SlipDetail")}
      footer={null}
      onCancel={requestClose}
      destroyOnHidden
    >
      <input
        ref={composer.fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => void composer.handleFiles(event.target.files)}
      />

      <div className="pd-stage-card">
        <div className="pd-stage-toolbar">
          <div className="pd-stage-tabs" role="tablist" aria-label={t("Patient:Stage:SelectAction")}>
            {STAGE_TABS.map((key) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={composer.tab === key}
                className={composer.tab === key ? "active" : undefined}
                onClick={() => composer.setTab(key)}
              >
                {t(TAB_COPY[key].label)}
                <em>{composer.counts[key]}</em>
              </button>
            ))}
          </div>
          <div className="pd-stage-actions">
            <Button className="pd-stage-pay" icon={<DollarOutlined />} onClick={onOpenPlan}>
              {t("Patient:Misc:Payment")}
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => setPrinting(true)}>
              {t("Patient:MedRecord:PrintHistory")}
            </Button>
          </div>
        </div>

        <div className="pd-stage-grid">
          <div>
            <ColumnHead>{t("Patient:Stage:Detail")}</ColumnHead>
            <StagePicks
              items={composer.offered}
              selectedIds={composer.selectedIds}
              emptyText={t(TAB_COPY[composer.tab].empty)}
              onToggle={composer.toggleItem}
            />
          </div>

          <div>
            <div className="pd-stage-colheads">
              <ColumnHead>{t("Patient:Debt:DateStaff")}</ColumnHead>
              <ColumnHead>{t("Patient:Plan:SelectedService")}</ColumnHead>
              <ColumnHead>{t("Patient:Stage:TreatmentContent")}</ColumnHead>
            </div>

            {composer.chosen.length === 0 ? (
              <p className="pd-stage-hint">{t("Patient:Stage:SelectHint")}</p>
            ) : (
              composer.chosen.map((item) => (
                <StageForm
                  key={item.id}
                  item={item}
                  draft={composer.draftOf(item)}
                  errors={composer.errorsOf(item)}
                  handlers={{
                    onChange: (patch) => composer.patchDraft(item, patch),
                    onToggleStep: (stepId, next) => composer.toggleStep(item, stepId, next),
                    onPickImages: () => composer.pickForForm(item),
                  }}
                  actions={
                    item === last
                      ? {
                          primaryLabel: t(TAB_COPY[composer.tab].save),
                          saving: composer.saving,
                          onSave: () => void composer.save(),
                          onCancel: requestClose,
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      <StageHistory
        days={composer.days}
        total={composer.stages.length}
        imagesOf={composer.imagesOf}
        savingNoteFor={composer.savingNoteFor}
        uploadingFor={composer.uploadingFor}
        completingId={composer.completingId}
        togglingStepFor={composer.togglingStepFor}
        onSaveNote={(stage, next) => void composer.saveNote(stage, next)}
        onComplete={(stage) => void composer.finish(stage)}
        onToggleStep={(stage, stepId, next) => void composer.toggleStageStep(stage, stepId, next)}
        onUpload={composer.pickForStage}
        onCreateLabo={setLaboStage}
        onWarranty={setWarrantyStage}
        warrantyOf={composer.warrantyOf}
      />

      <TreatmentHistoryPrintDialog
        open={printing}
        clinic={branch.data ?? { name: "", address: null, phone: null, email: null }}
        patient={{ code: patientCode, name: patientName }}
        stages={composer.stages}
        statusOf={composer.statusOf}
        onClose={() => setPrinting(false)}
      />

      <StageFollowUpDialog
        open={warrantyStage !== null}
        patientId={patientId}
        branchId={branchId}
        plan={plan}
        stage={warrantyStage}
        lineStages={composer.stages.filter(
          (stage) => stage.treatmentServiceId === warrantyStage?.treatmentServiceId,
        )}
        kind="guarantee"
        inheritSteps
        onClose={() => setWarrantyStage(null)}
      />

      <ConfirmDeleteDialog
        open={discarding}
        noun={t("Patient:Misc:Change")}
        title={t("Patient:Misc:CancelChanges")}
        question={t("Patient:Misc:ConfirmCancelQuestion")}
        confirmLabel={t("Patient:Misc:ConfirmCancel")}
        cancelLabel={t("Patient:Misc:ContinueEditing")}
        onConfirm={() => {
          setDiscarding(false);
          onClose();
        }}
        onClose={() => setDiscarding(false)}
      />

      <LaboOrderDialog
        open={laboStage !== null}
        branchId={branchId}
        patient={{ id: patientId, code: patientCode, name: patientName }}
        plan={plan}
        stage={laboStage}
        onClose={() => setLaboStage(null)}
      />
    </Modal>
  );
}
