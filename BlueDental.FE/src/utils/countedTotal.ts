import { t } from "@/lib/i18n";

/** Pager summary in the reference's own words: "Hiển thị 1–20 trên 213 bản ghi". */
export function countedTotal(unit: string) {
  return (total: number, range: [number, number]) =>
    t("Common:Pager:ShowRangeUnit", range[0], range[1], total, unit);
}
