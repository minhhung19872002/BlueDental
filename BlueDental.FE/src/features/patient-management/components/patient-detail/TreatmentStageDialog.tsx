import { useState } from "react";
import { Button, Modal } from "antd";
import { DollarOutlined, PrinterOutlined } from "@ant-design/icons";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LaboOrderDialog } from "./stage/LaboOrderDialog";
import { StageForm } from "./stage/StageForm";
import { StageHistory } from "./stage/StageHistory";
import { TreatmentHistoryPrintDialog } from "./stage/TreatmentHistoryPrintDialog";
import { StageFollowUpDialog } from "./stage/StageFollowUpDialog";
import { useStageComposer, type StageTab } from "./stage/useStageComposer";

interface Props {
  open: boolean;
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
  /** The slip the clicked row belongs to. */
  plan: TreatmentPlanSlipDto | null;
  /** The row that was clicked — selected when the dialog opens. */
  focusServiceId: string | null;
  onClose: () => void;
  /**
   * "Thanh toán" — the reference leaves the dialog for the slip's Kế hoạch
   * điều trị screen rather than opening a payment form here.
   */
  onOpenPlan: () => void;
}

const EMPTY_BY_TAB: Record<StageTab, string> = {
  add: "Tất cả dịch vụ đã được thêm công đoạn",
  continue: "Chưa có dịch vụ nào để tiếp tục công đoạn",
};

/** "Ngày - Nhân sự" · "Dịch vụ đã chọn" · "Nội dung điều trị". */
function ColumnHead({ children }: { children: string }) {
  return <div className="pd-stage-colhead">{children}</div>;
}

/**
 * "Chi tiết phiếu" — the dialog behind the treatment table's Công đoạn cell.
 *
 * Laid out from the reference's own dialog: a tabbed picker of the slip's
 * services on the left, the stage form beside it, and the slip's whole
 * "Lịch sử điều trị" underneath. Everything it reads and writes lives in
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
  onClose,
  onOpenPlan,
}: Props) {
  const staff = useStaffOptions();
  const branch = useBranchInfo(branchId);
  const composer = useStageComposer({ open, patientId, branchId, plan, focusServiceId });

  const [printing, setPrinting] = useState(false);
  const [laboStage, setLaboStage] = useState<TreatmentStageDto | null>(null);
  const [warrantyStage, setWarrantyStage] = useState<TreatmentStageDto | null>(null);

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className="pd-stage-dialog"
      title={t("Chi tiết phiếu")}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <input
        ref={composer.fileInput}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        hidden
        onChange={(event) => void composer.handleFiles(event.target.files)}
      />

      <div className="pd-stage-card">
        <div className="pd-stage-toolbar">
          <div className="pd-stage-tabs" role="tablist" aria-label={t("Chọn thao tác công đoạn")}>
            {(
              [
                ["add", t("THÊM CÔNG ĐOẠN"), composer.counts.add],
                ["continue", t("TIẾP TỤC CÔNG ĐOẠN"), composer.counts.continue],
              ] as const
            ).map(([key, label, count]) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={composer.tab === key}
                className={composer.tab === key ? "active" : undefined}
                onClick={() => {
                  composer.setTab(key);
                  composer.setSelected(null);
                }}
              >
                {label}
                <em>{count}</em>
              </button>
            ))}
          </div>
          <div className="pd-stage-actions">
            <Button className="pd-stage-pay" icon={<DollarOutlined />} onClick={onOpenPlan}>
              {t("Thanh toán")}
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => setPrinting(true)}>
              {t("In lịch sử điều trị")}
            </Button>
          </div>
        </div>

        <div className="pd-stage-grid">
          <div>
            <ColumnHead>{t("Chi tiết")}</ColumnHead>
            {composer.offered.length === 0 ? (
              <p className="pd-stage-empty">{t(EMPTY_BY_TAB[composer.tab])}</p>
            ) : (
              <div className="pd-stage-picks">
                {composer.offered.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={composer.selected === item.id ? "active" : undefined}
                    onClick={() => composer.setSelected(item.id)}
                  >
                    <strong>{item.serviceName ?? item.code}</strong>
                    <span>
                      {t("Răng")}:
                      {toothLabels(item.teeth).map((label) => (
                        <i key={label}>{label}</i>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="pd-stage-colheads">
              <ColumnHead>{t("Ngày - Nhân sự")}</ColumnHead>
              <ColumnHead>{t("Dịch vụ đã chọn")}</ColumnHead>
              <ColumnHead>{t("Nội dung điều trị")}</ColumnHead>
            </div>

            {composer.line === null ? (
              <p className="pd-stage-hint">
                {t("Chọn công đoạn ở cột chi tiết để hiển thị nội dung.")}
              </p>
            ) : (
              <StageForm
                line={composer.line}
                options={staff.data ?? []}
                staffId={composer.staffId}
                subStaffId={composer.subStaffId}
                secondStaffId={composer.secondStaffId}
                note={composer.note}
                pending={composer.pending}
                previews={composer.previews}
                saving={composer.saving}
                primaryLabel={
                  composer.tab === "add" ? t("Thêm công đoạn") : t("Tiếp tục công đoạn")
                }
                onStaff={composer.setStaffId}
                onSubStaff={composer.setSubStaffId}
                onSecondStaff={composer.setSecondStaffId}
                onNote={composer.setNote}
                onPickImages={() => composer.pickFor(null)}
                onRemoveImage={composer.removePending}
                onCancel={() => composer.setSelected(null)}
                onSave={() => void composer.save()}
              />
            )}
          </div>
        </div>
      </div>

      <StageHistory
        days={composer.days}
        total={composer.stages.length}
        liveStageIds={composer.liveStageIds}
        imagesOf={composer.imagesOf}
        savingNoteFor={composer.savingNoteFor}
        uploadingFor={composer.uploadingFor}
        completingId={composer.completingId}
        onSaveNote={(stage, next) => void composer.saveNote(stage, next)}
        onComplete={(stage) => void composer.finish(stage)}
        onUpload={(stage) => composer.pickFor(stage.id)}
        onCreateLabo={setLaboStage}
        onWarranty={setWarrantyStage}
        warrantable={composer.warrantable}
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
        kind="guarantee"
        onClose={() => setWarrantyStage(null)}
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
