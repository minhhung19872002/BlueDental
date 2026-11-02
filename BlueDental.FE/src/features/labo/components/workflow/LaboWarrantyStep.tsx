import { useState } from "react";
import { Button } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
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
  /** "Xem chi tiết" of an activated card (R-1120): only the cards, nothing to activate. */
  readOnly: boolean;
  focusTooth: number | null;
  onShowOrder: () => void;
  onClose: () => void;
}

type WarrantyView = "activate" | "cards";

/**
 * Tab 3 "Bảo hành" (P2910_03) in the Labo 3 mock's layout: the order band,
 * then two views — Kích hoạt bảo hành (teeth · card form · cards) while a Đạt
 * tooth still lacks a card, and the cards with their table. Activation itself
 * opens only once the whole order passed. P3110 REQ-E2 dropped the tooth's
 * Thông tin thẻ / Lịch sử panel.
 */
export function LaboWarrantyStep({ patient, order, readOnly, focusTooth, onShowOrder, onClose }: Props) {
  const warranty = useLaboWarrantyForm(order, readOnly);
  const [view, setView] = useState<WarrantyView>(warranty.editable ? "activate" : "cards");
  // Same fallback as the header's logo.
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";
  const restoration = restorationName(order);
  const rows = warrantyTeeth(order).map((tooth) => ({
    tooth,
    code: warrantyCardCode(tooth),
    cardPhotos: cardPhotoUrls(order, tooth.toothNumber),
  }));
  const canActivate = warranty.editable && warranty.open;
  const shown: WarrantyView = warranty.editable ? view : "cards";
  const cards = rows.map((row) => (
    <LaboWarrantyCard
      key={row.tooth.toothNumber}
      tooth={row.tooth}
      code={row.code}
      restoration={restoration}
      logoUrl={logoUrl}
      focused={row.tooth.toothNumber === focusTooth}
    />
  ));

  const tabs: { key: WarrantyView; label: string }[] = [
    ...(warranty.editable ? [{ key: "activate" as const, label: t("Labo:Warranty:ActivateTitle") }] : []),
    { key: "cards", label: `${t("Labo:Warranty:Title")} (${rows.length})` },
  ];

  return (
    <>
      <LaboOrderSummaryCard order={order} patient={patient} onShowOrder={onShowOrder} />
      <div className="pd-labo-flow-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={shown === tab.key}
            className={["pd-labo-flow-tab", shown === tab.key && "pd-labo-flow-tab--on"].filter(Boolean).join(" ")}
            onClick={() => setView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <span className="pd-labo-check-aside">
          {shown === "activate"
            ? t("Labo:Warranty:ReadyCount", warranty.readyCount, warranty.selected.length)
            : warranty.pending.length > 0
              ? t("Labo:Warranty:PendingCount", warranty.pending.length)
              : t("Labo:Warranty:CardsHint", rows.length)}
        </span>
      </div>
      {shown === "activate" ? (
        <LaboWarrantyActivationBox
          order={order}
          warranty={warranty}
          aside={<div className="pd-labo-warranty-cards pd-labo-warranty-cards--stack">{cards}</div>}
        />
      ) : (
        <div className="pd-labo-flow-main">
          <section className="pd-labo-flow-pane pd-labo-flow-pane--main">
            <div className="pd-labo-warranty-cards">{cards}</div>
            <LaboWarrantyTable rows={rows} focusTooth={focusTooth} />
          </section>
        </div>
      )}
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
