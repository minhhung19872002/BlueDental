import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

/**
 * Thiếu ngày bắt đầu, thời hạn — or Đủ thông tin once both are in; on the
 * tooth's card form and on its row in 1. Chọn răng kích hoạt alike.
 */
export function LaboWarrantyReadiness({ card }: { card: LaboWarrantyCardValues | undefined }) {
  const missing = [
    !card?.startDate && t("Labo:Warranty:StartDateShort"),
    card?.months == null && t("Labo:Warranty:DurationShort"),
  ].filter((part): part is string => Boolean(part));
  if (missing.length === 0) {
    return <StatusBadge label={t("Labo:Warranty:Ready")} {...LABO_PILL_TONE.success} />;
  }
  return <StatusBadge label={t("Labo:Warranty:Missing", missing.join(", "))} {...LABO_PILL_TONE.warning} />;
}
