import { Button } from "antd";
import { LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import type { TreatmentStageLaboDto } from "@/features/treatment-management/api/stageApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import "./stage-labo.css";

/**
 * On the công đoạn that raised a labo order (P2910_03): "LABO-xxxx · trạng
 * thái" and "Xem phiếu Labo", which opens the shared Labo dialog. Without the
 * Labo read leaf the chip shows alone.
 */
export function StageLaboChip({ labo, onView }: { labo: TreatmentStageLaboDto; onView?: () => void }) {
  const pill = laboStatusPill({ status: labo.status, isWarrantyExpired: labo.isWarrantyExpired });
  return (
    <div className="pd-stage-labo">
      <StatusBadge label={`${labo.orderCode} · ${t(pill.label)}`} bg={pill.bg} color={pill.color} />
      {onView && (
        <Button type="link" size="small" className="pd-stage-labo-view" onClick={onView}>
          {t("Patient:Stage:Labo:View")}
        </Button>
      )}
    </div>
  );
}

/** Under a Hoàn thành tick held back until the line's labo order passes QC. */
export function StageLaboLockNote() {
  return (
    <p className="pd-stage-labo-lock">
      <LockOutlined aria-hidden="true" />
      {t("Patient:Stage:Labo:Locked")}
    </p>
  );
}

/** "Kích hoạt bảo hành" on the line's latest công đoạn once its order is Hoàn thành; opens tab 3. */
export function StageLaboWarrantyButton({ onClick }: { onClick: () => void }) {
  return (
    <Button block type="primary" className="pd-stage-warranty" icon={<SafetyOutlined />} onClick={onClick}>
      {t("Labo:Workflow:WarrantyAction")}
    </Button>
  );
}
