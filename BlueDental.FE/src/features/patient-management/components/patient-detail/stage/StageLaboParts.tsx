import { Button } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
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

/**
 * Under a Hoàn thành tick held back by a labo order (P3110 m38): "🔒 Khoá:
 * LABO-xxx chưa kiểm tra", or — once it passed, but after this công đoạn's
 * day (note 27) — the day it passed; then "Xem phiếu Labo ›" on the check step.
 */
export function StageLaboLockNote({ order, onView }: { order: TreatmentStageLaboDto; onView?: () => void }) {
  const reason = order.qualityPassedOn
    ? t("Patient:Stage:Labo:LockedPassedOn", order.orderCode, formatDate(order.qualityPassedOn))
    : t("Patient:Stage:Labo:LockedBy", order.orderCode);
  return (
    <div className="pd-stage-labo-lock">
      <p>
        <LockOutlined aria-hidden="true" />
        {reason}
      </p>
      {onView && (
        <button type="button" className="pd-stage-labo-lock-view" onClick={onView}>
          {t("Patient:Stage:Labo:ViewMore")}
        </button>
      )}
    </div>
  );
}

/** "BN có n phiếu" beside Tạo Labo (P3110 m7): read only, the line's orders not cancelled. */
export function StageLaboCount({ count }: { count: number }) {
  return <span className="pd-stage-labo-count">{t("Patient:Stage:Labo:Count", count)}</span>;
}
