import { Button } from "antd";
import { CheckCircleFilled, SafetyCertificateOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboWarrantyActivationBox } from "../warranty/LaboWarrantyActivationBox";
import { LaboWarrantyCard } from "../warranty/LaboWarrantyCard";
import { LaboWarrantyTable } from "../warranty/LaboWarrantyTable";
import { cardPhotoUrls, restorationName, warrantyCardCode, warrantyTeeth } from "../warranty/laboWarrantyRules";
import { useLaboWarrantyForm } from "../warranty/useLaboWarrantyForm";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import { LaboOrderSummaryCard } from "./LaboOrderSummaryCard";
import "../check/labo-check.css";
import "../warranty/labo-warranty.css";

interface Props {
  patient: LaboWorkflowPatient;
  order: LaboOrderDto;
  onShowOrder: () => void;
  onClose: () => void;
}

/**
 * Tab 3 "Bảo hành" (P2910_03): a warranty card per Đạt tooth. Teeth still
 * without a card are picked and activated in the box on top — only once the
 * whole order passed; the cards and the table follow. P3110 REQ-E2 dropped
 * the tooth's Thông tin thẻ / Lịch sử panel under them.
 */
export function LaboWarrantyStep({ patient, order, onShowOrder, onClose }: Props) {
  const warranty = useLaboWarrantyForm(order);
  // Same fallback as the header's logo.
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";
  const restoration = restorationName(order);
  const rows = warrantyTeeth(order).map((tooth) => ({
    tooth,
    code: warrantyCardCode(order, tooth),
    cardPhotos: cardPhotoUrls(order, tooth.toothNumber),
  }));
  const canActivate = warranty.editable && warranty.open;

  return (
    <>
      <LaboOrderSummaryCard order={order} patient={patient} onShowOrder={onShowOrder} />
      <section className="pd-labo-check-section">
        <header className="pd-labo-check-head">
          <CheckCircleFilled className="pd-labo-warranty-done" />
          <h3>{t("Labo:Warranty:Title")}</h3>
          <span className="pd-labo-check-aside">
            {warranty.pending.length > 0
              ? t("Labo:Warranty:PendingCount", warranty.pending.length)
              : t("Labo:Warranty:CardsHint", rows.length)}
          </span>
        </header>
        {warranty.editable && <LaboWarrantyActivationBox order={order} warranty={warranty} />}
        <div className="pd-labo-warranty-cards">
          {rows.map((row) => (
            <LaboWarrantyCard
              key={row.tooth.toothNumber}
              tooth={row.tooth}
              code={row.code}
              restoration={restoration}
              logoUrl={logoUrl}
            />
          ))}
        </div>
        <LaboWarrantyTable rows={rows} />
      </section>
      <div className="pd-labo-footer pd-labo-step-footer">
        <span className="pd-labo-footer-hint">
          {t(canActivate ? "Labo:Warranty:FooterActivate" : "Labo:Warranty:FooterTrack")}
        </span>
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          {canActivate && (
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={warranty.busy}
              disabled={warranty.busy || warranty.selected.length === 0}
              onClick={() => void warranty.activate()}
            >
              {t("Labo:Warranty:Activate", warranty.selected.length)}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
