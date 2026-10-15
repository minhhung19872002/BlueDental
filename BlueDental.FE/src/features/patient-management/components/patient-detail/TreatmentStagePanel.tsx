import { useState } from "react";
import { Button } from "antd";
import { DollarOutlined, PrinterOutlined } from "@ant-design/icons";
import { useAbility } from "@/hooks/useAbility";
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
import type { StageTab } from "./stage/stageModel";
import type { StageComposer } from "./stage/useStageComposer";
import "./patient-detail.css";

/** i18n keys per tab: its caption, what an empty tab says, its save button. */
const TAB_COPY: Record<StageTab, { label: string; empty: string; save: string }> = {
  add: {
    label: "Patient:Stage:AddLabel",
    empty: "Patient:Stage:EmptyAdd",
    save: "Patient:Stage:SaveStage",
  },
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

export interface StagePatient {
  id: string;
  code: string;
  name: string;
}

interface Props {
  patient: StagePatient;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  composer: StageComposer;
  /** The tabs the user's leaves allow — see {@link useStageTabs}. */
  allowedTabs: readonly StageTab[];
  /** The form's "Hủy". */
  onCancel: () => void;
  /** "Thanh toán". */
  onOpenPlan: () => void;
}

/**
 * The body of "Chi tiết phiếu": three tabs (THÊM CÔNG ĐOẠN, TIẾP TỤC CÔNG
 * ĐOẠN, TIẾP TỤC BẢO HÀNH), the tab's cards on the left with the open card's
 * form beside them, and "Lịch sử điều trị" underneath. The patient record
 * shows it in {@link TreatmentStageDialog}; the slip page shows it inline under
 * its service table (BA 2026-10-15). See docs/clone/pages/patient-detail.md.
 */
export function TreatmentStagePanel({
  patient,
  branchId,
  plan,
  composer,
  allowedTabs,
  onCancel,
  onOpenPlan,
}: Props) {
  const branch = useBranchInfo(branchId);
  // "Thanh toán" leads to collecting money on the slip — payment.create.
  const canPay = useAbility("payment").canCreate;
  const stageAbility = useAbility("treatmentStage");
  const canCreateLabo = useAbility("treatmentLabo").canCreate;

  const [printing, setPrinting] = useState(false);
  const [laboStage, setLaboStage] = useState<TreatmentStageDto | null>(null);
  const [warrantyStage, setWarrantyStage] = useState<TreatmentStageDto | null>(null);

  const last = composer.chosen[composer.chosen.length - 1];

  return (
    <div className="pd-stage-panel">
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
          <div
            className="pd-stage-tabs"
            role="tablist"
            aria-label={t("Patient:Stage:SelectAction")}
          >
            {allowedTabs.map((key) => (
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
            {canPay && (
              <Button className="pd-stage-pay" icon={<DollarOutlined />} onClick={onOpenPlan}>
                {t("Patient:Misc:Payment")}
              </Button>
            )}
            {stageAbility.can("print") && (
              <Button icon={<PrinterOutlined />} onClick={() => setPrinting(true)}>
                {t("Patient:MedRecord:PrintHistory")}
              </Button>
            )}
          </div>
        </div>

        {allowedTabs.length > 0 && (
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
                            onCancel,
                          }
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <StageHistory
        days={composer.days}
        total={composer.shownCount}
        imagesOf={composer.imagesOf}
        historyTeethOf={composer.historyTeethOf}
        savingNoteFor={composer.savingNoteFor}
        uploadingFor={composer.uploadingFor}
        completingId={composer.completingId}
        can={{
          update: stageAbility.canUpdate,
          complete: stageAbility.can("complete"),
          warranty: stageAbility.canCreate,
          labo: canCreateLabo,
        }}
        onSaveNote={(stage, next) => void composer.saveNote(stage, next)}
        onComplete={(stage) => void composer.finish(stage)}
        onUpload={composer.pickForStage}
        onCreateLabo={setLaboStage}
        onWarranty={setWarrantyStage}
        warrantyOf={composer.warrantyOf}
      />

      <TreatmentHistoryPrintDialog
        open={printing}
        clinic={branch.data ?? { name: "", address: null, phone: null, email: null }}
        patient={{ code: patient.code, name: patient.name }}
        stages={composer.stages}
        statusOf={composer.statusOf}
        onClose={() => setPrinting(false)}
      />

      <StageFollowUpDialog
        open={warrantyStage !== null}
        patientId={patient.id}
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

      <LaboOrderDialog
        open={laboStage !== null}
        branchId={branchId}
        patient={patient}
        plan={plan}
        stage={laboStage}
        onClose={() => setLaboStage(null)}
      />
    </div>
  );
}
