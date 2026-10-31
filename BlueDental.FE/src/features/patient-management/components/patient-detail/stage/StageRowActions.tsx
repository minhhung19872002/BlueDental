import { Button, Checkbox } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import { LABO_STATUS } from "@/features/labo/api/laboApi";
import type { LaboStep } from "@/features/labo/components/workflow/laboWorkflowSteps";
import { StageLaboCount, StageLaboLockNote } from "./StageLaboParts";
import { StageWarrantyButton } from "./StageWarrantyButton";
import type { WarrantyState } from "./stageModel";

export interface StageHistoryLeaves {
  /** treatmentStage.update — the note pencil and "Tải ảnh". */
  update: boolean;
  /** treatmentStage.complete — the "Hoàn thành" tick. */
  complete: boolean;
  /** treatmentStage.create — "Bảo hành dịch vụ". */
  warranty: boolean;
  /** treatmentLabo.create — "Tạo Labo". */
  labo: boolean;
  /** treatmentLabo.read — "Xem phiếu Labo" beside the order chip and under the lock. */
  laboRead: boolean;
}

export interface StageRowHandlers {
  onComplete: (stage: TreatmentStageDto) => void;
  onUpload: (stage: TreatmentStageDto) => void;
  onCreateLabo: (stage: TreatmentStageDto) => void;
  /** The shared Labo dialog on a saved order, at a step when given. */
  onOpenLabo: (orderId: string, step?: LaboStep) => void;
  /** "Bảo hành dịch vụ": the slip's Bảo hành tab (P3110 D1). */
  onWarranty: (stage: TreatmentStageDto) => void;
}

interface Props {
  stage: TreatmentStageDto;
  can: StageHistoryLeaves;
  completing: boolean;
  uploading: boolean;
  warranty: WarrantyState;
  handlers: StageRowHandlers;
}

/**
 * Hành động of a LỊCH SỬ ĐIỀU TRỊ row. Hoàn thành turns both ways (the
 * reference keeps a `revert-status` beside its `status`); only an earlier công
 * đoạn of the line, one mid-request, or one a labo order holds back is locked.
 * The labo lock tints the cell and names its order (P3110 m38) but leaves "Tải
 * ảnh" usable (note 16). A finished công đoạn swaps Tạo Labo for "Bảo hành
 * dịch vụ"; a continued one offers neither, nor does one whose own labo order
 * still stands (its chip opens it). "BN có n phiếu" rides beside Tạo Labo (m7).
 */
export function StageRowActions({ stage, can, completing, uploading, warranty, handlers }: Props) {
  const live = !stage.isSuperseded;
  const done = stage.completedAt !== null;
  const lockingOrder = stage.completeLockedByLaboOrder;
  const raisedLabo = stage.labo !== null && stage.labo.status !== LABO_STATUS.Cancelled;
  const offersLabo = !done && live && can.labo && !raisedLabo;

  return (
    <div
      className={["pd-stage-rowactions", stage.completeLockedByLabo && "pd-stage-rowactions--locked"]
        .filter(Boolean)
        .join(" ")}
    >
      <Checkbox
        checked={done}
        disabled={!can.complete || !live || completing || stage.completeLockedByLabo}
        onChange={() => handlers.onComplete(stage)}
      >
        {t("Patient:Misc:Done")}
      </Checkbox>
      {lockingOrder && (
        <StageLaboLockNote
          order={lockingOrder}
          onView={can.laboRead ? () => handlers.onOpenLabo(lockingOrder.orderId, "check") : undefined}
        />
      )}
      {can.update && (
        <Button
          block
          icon={<PictureOutlined />}
          disabled={!live}
          loading={uploading}
          onClick={() => handlers.onUpload(stage)}
        >
          {t("Patient:Photo:Upload")}
        </Button>
      )}
      {done && can.warranty && (
        <StageWarrantyButton state={warranty} onClick={() => handlers.onWarranty(stage)} />
      )}
      {offersLabo && (
        <div className="pd-stage-labo-create">
          <Button type="primary" onClick={() => handlers.onCreateLabo(stage)}>
            {t("Patient:Labo:Create")}
          </Button>
          {stage.lineLaboOrderCount > 0 && <StageLaboCount count={stage.lineLaboOrderCount} />}
        </div>
      )}
    </div>
  );
}
