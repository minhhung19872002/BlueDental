import { t } from "@/lib/i18n";

/**
 * Pager summary in the reference's own words, shared by the screens that show
 * it this way (Vận hành's article table, Công cụ's lists).
 *
 * It drops the range when there is nothing to range over — "Hiển thị 0 trên 0",
 * not "Hiển thị 0–0 trên 0" — and names no unit, unlike Danh mục.
 */
export function pagerTotal(total: number, range: [number, number]) {
  return total === 0
    ? t("Common:Pager:ShowZero")
    : t("Common:Pager:ShowRange", range[0], range[1], total);
}
