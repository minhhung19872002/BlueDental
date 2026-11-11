import { useState, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { DollarOutlined, PrinterOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useAbility } from "@/hooks/useAbility";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { planDetailPath } from "@/features/treatment-management/components/plan/planTypes";
import { PLAN_TAB } from "@/features/treatment-management/components/plan-detail/planDetailTypes";
import { sourceFromStage } from "@/features/labo/components/order-dialogs/laboOrderSource";
import { LaboWorkflowDialog } from "@/features/labo/components/workflow/LaboWorkflowDialog";
import type { LaboWorkflowTarget } from "@/features/labo/components/workflow/laboWorkflowSteps";
import { StageItemForm } from "./stage/StageItemForm";
import { StageChangeLogDialog } from "./stage/StageChangeLogDialog";
import { StageHistory } from "./stage/StageHistory";
import { StagePicks } from "./stage/StagePicks";
import { TreatmentHistoryPrintDialog } from "./stage/TreatmentHistoryPrintDialog";
import type { StageTab } from "./stage/stageModel";
import type { StageComposer } from "./stage/useStageComposer";
import { useStageDelete } from "./stage/useStageDelete";
import { useStageImageDelete } from "./stage/useStageImageDelete";
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

/**
 * "Ngày - Nhân sự" · "Nội dung điều trị" · "Ghi chú lịch hẹn"; `wide` takes two
 * cells, as Nội dung điều trị does since "Dịch vụ đã chọn" went (R-1206).
 */
function ColumnHead({ children, wide = false }: { children: string; wide?: boolean }) {
  return <div className={wide ? "pd-stage-colhead pd-stage-colhead--wide" : "pd-stage-colhead"}>{children}</div>;
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
  /** "Thanh toán"; left out, the button is not shown (the slip page). */
  onOpenPlan?: () => void;
  /** Handed to "Lịch sử điều trị" — the slip page's back-to-top anchor. */
  historyRef?: Ref<HTMLDivElement>;
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
  historyRef,
}: Props) {
  const branch = useBranchInfo(branchId);
  // "Thanh toán" leads to collecting money on the slip — payment.create.
  const canPay = useAbility("payment").canCreate;
  const stageAbility = useAbility("treatmentStage");
  const laboAbility = useAbility("treatmentLabo");
  const imageAbility = useAbility("treatmentImage");
  const imageDelete = useStageImageDelete();
  const stageDelete = useStageDelete();

  const [printing, setPrinting] = useState(false);
  const [laboTarget, setLaboTarget] = useState<LaboWorkflowTarget | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  // The slip the history belongs to; a deleted công đoạn's log is still read by it.
  const treatmentId = plan?.id ?? composer.stages.find((stage) => stage.treatmentId)?.treatmentId ?? null;

  const navigate = useNavigate();
  const last = composer.chosen[composer.chosen.length - 1];

  // "Bảo hành dịch vụ" leads to the slip's Bảo hành tab, on this line (P3110 D1).
  const handleWarranty = (stage: TreatmentStageDto) => {
    if (!stage.treatmentId) return;
    navigate(
      planDetailPath(patient.id, stage.treatmentId, branchId, PLAN_TAB.warranty, stage.treatmentServiceId),
    );
  };

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
            {canPay && onOpenPlan && (
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
                <ColumnHead wide>{t("Patient:Stage:TreatmentContent")}</ColumnHead>
                <ColumnHead>{t("Patient:Stage:AppointmentNote")}</ColumnHead>
              </div>

              {composer.chosen.length === 0 ? (
                <p className="pd-stage-hint">{t("Patient:Stage:SelectHint")}</p>
              ) : (
                composer.chosen.map((item) => (
                  <StageItemForm
                    key={item.id}
                    item={item}
                    composer={composer}
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
        ref={historyRef}
        days={composer.days}
        total={composer.shownCount}
        imagesOf={composer.imagesOf}
        historyTeethOf={composer.historyTeethOf}
        statusOf={composer.statusOf}
        savingNoteFor={composer.savingNoteFor}
        savingRemarkFor={composer.savingRemarkFor}
        uploadingFor={composer.uploadingFor}
        completingId={composer.completingId}
        can={{
          update: stageAbility.canUpdate,
          complete: stageAbility.can("complete"),
          warranty: stageAbility.canCreate,
          labo: laboAbility.canCreate,
          laboRead: laboAbility.canRead,
          imageDelete: imageAbility.canDelete,
          delete: stageAbility.canDelete,
        }}
        onSaveNote={(stage, next) => void composer.saveNote(stage, next)}
        onSaveRemark={composer.saveRemark}
        onDeleteImage={imageDelete.ask}
        onComplete={(stage) => void composer.finish(stage)}
        onUpload={composer.pickForStage}
        onCreateLabo={(stage) => setLaboTarget({ kind: "create", source: sourceFromStage(plan, stage) })}
        onOpenLabo={(orderId, step) => setLaboTarget({ kind: "open", orderId, step })}
        onWarranty={handleWarranty}
        onDelete={stageDelete.ask}
        onOpenChangeLog={() => setLogOpen(true)}
        warrantyOf={composer.warrantyOf}
        laboListHref={withBranch(`/patient/${patient.id}?tab=labo`, branchId)}
      />

      <TreatmentHistoryPrintDialog
        open={printing}
        clinic={branch.data ?? { name: "", address: null, phone: null, email: null }}
        patient={{ code: patient.code, name: patient.name }}
        stages={composer.stages}
        statusOf={composer.statusOf}
        onClose={() => setPrinting(false)}
      />

      <ConfirmDeleteDialog
        open={imageDelete.removing !== null}
        noun={t("Patient:Image:Noun")}
        title={t("Patient:Image:DeleteTitle")}
        question={t("Patient:Image:DeleteQuestion")}
        pending={imageDelete.pending}
        onConfirm={() => void imageDelete.confirm()}
        onClose={imageDelete.cancel}
      />

      <ConfirmDeleteDialog
        open={stageDelete.removing !== null}
        noun={t("Patient:Stage:DeleteNoun")}
        title={t("Patient:Stage:Delete")}
        question={t("Patient:Stage:DeleteQuestion")}
        pending={stageDelete.pending}
        onConfirm={() => void stageDelete.confirm()}
        onClose={stageDelete.cancel}
      />

      <StageChangeLogDialog treatmentId={logOpen ? treatmentId : null} onClose={() => setLogOpen(false)} />

      <LaboWorkflowDialog
        target={laboTarget}
        branchId={branchId}
        patient={patient}
        onClose={() => setLaboTarget(null)}
      />
    </div>
  );
}
