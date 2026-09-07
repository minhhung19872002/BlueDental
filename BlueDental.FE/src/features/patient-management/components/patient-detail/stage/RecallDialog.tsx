import { Button, Checkbox, Modal } from "antd";
import { CalendarOutlined, EyeOutlined, PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import { reExaminationChecklist } from "./reExaminationChecklist";
import { StageStepList } from "./StageStepList";

interface Props {
  open: boolean;
  /** Every finished công đoạn on the record — what a tái khám can follow. */
  stages: TreatmentStageDto[];
  onClose: () => void;
  /** Books the follow-up appointment for that công đoạn's service. */
  onBook: (stage: TreatmentStageDto) => void;
  /** Opens "Chi tiết phiếu" on that công đoạn's slip. */
  onDetail: (stage: TreatmentStageDto) => void;
}

/**
 * "Tạo tái khám" — the finished công đoạn a follow-up can be booked against.
 *
 * The reference lists nothing until a công đoạn is actually complete, printing
 * "Chưa có dịch vụ hoàn tất"; once one is, the row carries its date and staff,
 * the service it finished and its note, with Tái Khám and Chi Tiết beside a
 * ticked, read-only Hoàn thành.
 */
export function RecallDialog({ open, stages, onClose, onBook, onDetail }: Props) {
  return (
    <Modal
      open={open}
      title={t("Tạo tái khám")}
      width="calc(100vw - 32px)"
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      className="pd-recall-dialog"
    >
      <div className="pd-recall-head">
        <strong>{t("Ngày - Nhân sự")}</strong>
        <strong>{t("Dịch vụ đã hoàn tất")}</strong>
        <strong>{t("Nội dung điều trị")}</strong>
      </div>

      {stages.length === 0 ? (
        <div className="pd-recall-empty">{t("Chưa có dịch vụ hoàn tất")}</div>
      ) : (
        <div className="pd-recall-rows">
          {stages.map((stage) => (
            <div className="pd-recall-row" key={stage.id}>
              <div className="pd-recall-when">
                <p>{formatShortDate(stage.completedAt ?? stage.creationTime)}</p>
                <p>
                  {t("Bác sĩ")}: {stage.staffName ?? "—"}
                </p>
                <p>
                  {t("Phụ tá")}: {stage.subStaffName ?? "—"}
                </p>
              </div>

              <div className="pd-recall-service">
                <strong>{stage.serviceName ?? stage.name}</strong>
                <div>
                  {toothLabels(stage.teeth).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>

              <div className="pd-recall-note">
                <p>{stage.note ?? ""}</p>
                {/* Read-only here: the reference draws these ticked-off boxes
                    disabled on the listing, and only lets you touch them once
                    Tái Khám has opened the form. */}
                <StageStepList steps={reExaminationChecklist(stage)} checked={[]} tone="accent" />
              </div>

              <div className="pd-recall-actions">
                <Checkbox checked disabled>
                  {t("Hoàn thành")}
                </Checkbox>
                <Button block icon={<PictureOutlined />} disabled>
                  {t("Tải Ảnh")}
                </Button>
                <Button block type="primary" icon={<CalendarOutlined />} onClick={() => onBook(stage)}>
                  {t("Tái Khám")}
                </Button>
                <Button block type="primary" icon={<EyeOutlined />} onClick={() => onDetail(stage)}>
                  {t("Chi Tiết")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
