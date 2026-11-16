import type { CatalogEntryDto } from "../api/taxonomyApi";
import { formatMoneyUnit } from "@/utils/format";

/** "Giá sau giảm" below the list price, and the share it takes off — null when nothing is. */
function saleFigures(entry: CatalogEntryDto) {
  const price = entry.price;
  const sale = entry.serviceConfig?.priceAfterDiscount;
  if (price == null || sale == null || sale >= price || price <= 0) return null;
  return { price, sale, percent: Math.round(((price - sale) / price) * 100) };
}

/**
 * The Giá cell of a priced row. A service Danh mục discounts reads its list
 * price struck through, the share off beside it, and under them the "Giá sau
 * giảm" every slip sells it at (R-1239) — the same figures a combo row shows.
 */
export function ServicePriceCell({ entry }: { entry: CatalogEntryDto }) {
  const figures = saleFigures(entry);
  if (!figures) {
    return (
      <span className="bd-cat-price">
        {entry.price == null ? "—" : formatMoneyUnit(entry.price)}
      </span>
    );
  }
  return (
    <div className="bd-combo-price bd-cat-sale">
      <span className="bd-combo-price-was">
        <s>{formatMoneyUnit(figures.price)}</s>
        <span className="bd-combo-off">-{figures.percent}%</span>
      </span>
      <span className="bd-cat-price">{formatMoneyUnit(figures.sale)}</span>
    </div>
  );
}
