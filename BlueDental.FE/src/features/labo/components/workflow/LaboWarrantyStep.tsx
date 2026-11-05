import { useState } from "react";
import { Button } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboWarrantyActivationBox } from "../warranty/LaboWarrantyActivationBox";
import { LaboWarrantyOverview } from "../warranty/LaboWarrantyOverview";
import type { LaboWarrantyRow } from "../warranty/LaboWarrantyTable";
import {
  cardPhotoUrls,
  isActivated,
  restorationName,
  warrantyCardCode,
  warrantyTeeth,
} from "../warranty/laboWarrantyRules";
import { useLaboWarrantyForm, type LaboWarrantyForm } from "../warranty/useLaboWarrantyForm";
import { useWarrantyActiveTooth } from "../warranty/useWarrantyActiveTooth";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import { LaboOrderSummaryCard } from "./LaboOrderSummaryCard";
import "../check/labo-check.css";
import "../warranty/labo-warranty.css";
import "../warranty/labo-warranty-v2.css";

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

/** Tất cả răng đã chọn đều đủ thông tin · Còn n răng thiếu … (BA mock BaoHanhV2). */
function footerHint(warranty: LaboWarrantyForm, canActivate: boolean): string {
  if (!canActivate) return t("Labo:Warranty:FooterTrack");
  const picked = warranty.selected.length;
  if (picked === 0) return t("Labo:Warranty:FooterActivate");
  if (warranty.readyCount === picked) return t("Labo:Warranty:FooterAllReady");
  return t("Labo:Warranty:FooterMissing", picked - warranty.readyCount);
}

/**
 * Tab 3 "Bảo hành" (P2910_03) in the BaoHanhV2 mock's layout (R-1152): the
 * order band, then Kích hoạt bảo hành (teeth · the open tooth's card form ·
 * its preview) while a Đạt tooth still lacks a card, and Tổng quan thẻ bảo
 * hành — every card, the ones still being typed with "Chỉnh sửa", and the
 * table. Activation itself opens only once the whole order passed.
 */
export function LaboWarrantyStep({ patient, order, readOnly, focusTooth, onShowOrder, onClose }: Props) {
  const warranty = useLaboWarrantyForm(order, readOnly);
  const [view, setView] = useState<WarrantyView>(warranty.editable ? "activate" : "cards");
  // Same fallback as the header's logo.
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";
  const restoration = restorationName(order);
  const canActivate = warranty.editable && warranty.open;
  const isPicked = (tooth: number) => warranty.open && warranty.selected.includes(tooth);
  const active = useWarrantyActiveTooth(
    warranty.pending.filter((tooth) => isPicked(tooth.toothNumber)).map((tooth) => tooth.toothNumber),
  );
  const rows: LaboWarrantyRow[] = warrantyTeeth(order).map((tooth) => {
    // Only while activation is on offer is an unactivated tooth a card being typed.
    const card = canActivate && !isActivated(tooth) ? warranty.sharing.cardOf(tooth.toothNumber) : null;
    return {
      tooth,
      code: card === null ? warrantyCardCode(tooth) : card?.manufacturerSerial?.trim() || "—",
      cardPhotos: cardPhotoUrls(order, tooth.toothNumber),
      draft: card === null ? undefined : { card, picked: isPicked(tooth.toothNumber) },
    };
  });
  const shown: WarrantyView = warranty.editable ? view : "cards";
  const allReady = warranty.selected.length > 0 && warranty.readyCount === warranty.selected.length;

  const handleEdit = (tooth: number) => {
    if (!warranty.selected.includes(tooth)) warranty.toggle(tooth);
    active.show(tooth);
    setView("activate");
  };

  const tabs: { key: WarrantyView; label: string }[] = [
    ...(warranty.editable ? [{ key: "activate" as const, label: t("Labo:Warranty:ActivateTitle") }] : []),
    { key: "cards", label: t("Labo:Warranty:OverviewTitle", rows.length) },
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
          {canActivate
            ? t("Labo:Warranty:ReadyCount", warranty.readyCount, warranty.selected.length)
            : warranty.pending.length > 0
              ? t("Labo:Warranty:PendingCount", warranty.pending.length)
              : t("Labo:Warranty:CardsHint", rows.length)}
        </span>
      </div>
      {shown === "activate" ? (
        <LaboWarrantyActivationBox order={order} warranty={warranty} logoUrl={logoUrl} active={active} />
      ) : (
        <LaboWarrantyOverview
          rows={rows}
          restoration={restoration}
          what={[restoration, order.supplierName].filter(Boolean).join(" · ")}
          logoUrl={logoUrl}
          focusTooth={focusTooth}
          onEdit={canActivate ? handleEdit : undefined}
        />
      )}
      <div className="pd-labo-footer pd-labo-step-footer">
        <span className="pd-labo-footer-hint">{footerHint(warranty, canActivate)}</span>
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          {canActivate && (
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={warranty.busy}
              disabled={warranty.busy || !allReady}
              onClick={() => void warranty.activate()}
            >
              {t("Labo:Warranty:ActivateOf", warranty.readyCount, warranty.selected.length)}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
