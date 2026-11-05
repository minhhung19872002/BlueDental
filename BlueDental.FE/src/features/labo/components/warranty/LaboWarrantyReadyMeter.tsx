import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";

/** "Đủ thông tin · r/s răng" and its green bar, under 1. Chọn răng kích hoạt (BA mock BaoHanhV2). */
export function LaboWarrantyReadyMeter({ ready, total }: { ready: number; total: number }) {
  const share = { "--pd-ready-share": `${total > 0 ? Math.round((ready / total) * 100) : 0}%` } as CSSProperties;
  return (
    <div className="pd-labo-wready">
      <span className="pd-labo-wready-label">
        <span>{t("Labo:Warranty:Ready")}</span>
        <strong>{t("Labo:Warranty:ReadyOf", ready, total)}</strong>
      </span>
      <span className="pd-labo-wready-bar" style={share} />
    </div>
  );
}
