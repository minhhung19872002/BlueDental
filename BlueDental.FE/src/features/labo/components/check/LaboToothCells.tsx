import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";

/** The shade the tooth was ordered in, as text — the swatch went (P0111_02, R-1109). */
export function LaboToothShade({ shade }: { shade?: string | null }) {
  return (
    <span className="pd-labo-tooth-shade">
      {shade || "—"}
    </span>
  );
}

/** Đã trả n lần — red from the second return, and a nudge to the manager from the third (P3110 REQ-D5). */
export function LaboReturnCount({ count }: { count: number }) {
  const className = ["pd-labo-tooth-returns", count >= 2 && "pd-labo-tooth-returns--alert"].filter(Boolean).join(" ");
  return (
    <span className={className}>
      <span>
        {t("Labo:Check:Returns")} <b>{count}</b> {t("Labo:Check:ReturnsUnit")}
      </span>
      {count >= 3 && <small>{t("Labo:Check:ReturnsAlert")}</small>}
    </span>
  );
}

/** BH Labo: "— chưa đạt", "chưa kích hoạt" or "đã kích hoạt · BH-…" (P3110 REQ-D8, m342; P0111_02 R-1112 dropped "· bật sau khi lắp"). */
export function LaboToothWarranty({ tooth, passed }: { tooth: LaboOrderToothDto; passed: boolean }) {
  if (tooth.warrantyActivatedAt) {
    return (
      <span className="pd-labo-tooth-warranty">
        {t("Labo:Check:Warranty")} <b>{t("Labo:Check:WarrantyActive")}</b>
        {tooth.warrantyCardCode ? ` · ${tooth.warrantyCardCode}` : ""}
      </span>
    );
  }
  return (
    <span className="pd-labo-tooth-warranty">
      {t("Labo:Check:Warranty")} {t(passed ? "Labo:Check:WarrantyInactive" : "Labo:Check:WarrantyNotPassed")}
    </span>
  );
}
