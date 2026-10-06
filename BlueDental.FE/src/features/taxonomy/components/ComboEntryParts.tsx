import { Layers } from "lucide-react";
import type { CatalogEntryDto } from "../api/taxonomyApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit, formatVND } from "@/utils/format";

/** Tổng giá lẻ, Giá combo and what the customer saves, as one combo row shows them. */
export function comboFigures(entry: CatalogEntryDto) {
  const retail = entry.retailPrice ?? 0;
  const price = entry.price ?? 0;
  const savings = Math.max(retail - price, 0);
  return {
    retail,
    price,
    savings,
    percent: retail > 0 ? Math.round((savings / retail) * 100) : 0,
    units: entry.comboItems.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/** The name cell of a combo: its layers mark, the COMBO tag, and "code · N thành phần · M đơn vị". */
export function ComboNameCell({ entry }: { entry: CatalogEntryDto }) {
  const { units } = comboFigures(entry);
  return (
    <div className="bd-cat-inline3">
      <span className="bd-combo-avatar" aria-hidden="true">
        <Layers size={16} />
      </span>
      <div className="bd-min0">
        <p className={entry.isDeleted ? "bd-cat-name bd-cat-name--deleted" : "bd-cat-name"}>
          {entry.name}
          <span className="bd-combo-tag">{t("Taxonomy:Combo:Tag")}</span>
          {entry.isDeleted && <span className="bd-combo-tag bd-combo-tag--off">{t("Taxonomy:Combo:Inactive")}</span>}
        </p>
        <p className="bd-cat-subtle">
          {[entry.code, t("Taxonomy:Combo:PartCount", entry.comboItems.length), t("Taxonomy:Combo:UnitCount", units)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

/** The price cell of a combo: Giá combo, with Tổng giá lẻ struck through and the saving under it. */
export function ComboPriceCell({ entry }: { entry: CatalogEntryDto }) {
  const { retail, price, percent } = comboFigures(entry);
  return (
    <div className="bd-combo-price">
      <span className="bd-cat-price">{formatMoneyUnit(price)}</span>
      {retail > price && (
        <span className="bd-combo-price-was">
          <s>{formatMoneyUnit(retail)}</s>
          <span className="bd-combo-off">-{percent}%</span>
        </span>
      )}
    </div>
  );
}

/** A combo row opened: every component with its quantity, kind, Giá lẻ and Giá combo. */
export function ComboExpandedRow({ entry }: { entry: CatalogEntryDto }) {
  const { retail, price, savings } = comboFigures(entry);
  return (
    <div className="bd-combo-detail">
      <table className="bd-combo-detail-table">
        <thead>
          <tr>
            <th>{t("Taxonomy:Combo:ColQty")}</th>
            <th>{t("Taxonomy:Combo:ColComponent")}</th>
            <th>{t("Taxonomy:Combo:ColKind")}</th>
            <th className="bd-combo-col-money">{t("Taxonomy:Combo:ColRetail")}</th>
            <th className="bd-combo-col-money">{t("Taxonomy:Combo:ComboPrice")}</th>
          </tr>
        </thead>
        <tbody>
          {entry.comboItems.map((item) => (
            <tr key={item.componentEntryId}>
              <td className="bd-combo-qty">×{item.quantity}</td>
              <td>{item.componentName}</td>
              <td>
                <span className="bd-combo-kind">{t("Taxonomy:Combo:KindServiceShort")}</span>
              </td>
              <td className="bd-combo-col-money">{formatVND((item.componentPrice ?? 0) * item.quantity)}</td>
              <td className="bd-combo-col-money bd-combo-strong">{formatVND(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bd-combo-detail-foot">
        <span>
          {t("Taxonomy:Combo:RetailTotal")} <b>{formatMoneyUnit(retail)}</b>
        </span>
        <span>
          {t("Taxonomy:Combo:ComboPrice")} <b>{formatMoneyUnit(price)}</b>
        </span>
        <span className="bd-combo-detail-save">
          {t("Taxonomy:Combo:CustomerSaves")} <b>{formatMoneyUnit(savings)}</b>
        </span>
      </p>
    </div>
  );
}
