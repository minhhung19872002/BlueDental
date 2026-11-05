import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import { missingText } from "./laboWarrantyDraft";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

/**
 * Thiếu ngày bắt đầu, thời hạn — or Đủ thông tin once both are in; on the
 * tooth's card form and on its row in 1. Chọn răng kích hoạt alike.
 */
export function LaboWarrantyReadiness({ card }: { card: LaboWarrantyCardValues | undefined }) {
  const missing = missingText(card);
  if (!missing) {
    return <StatusBadge label={t("Labo:Warranty:Ready")} {...LABO_PILL_TONE.success} />;
  }
  return <StatusBadge label={missing} {...LABO_PILL_TONE.warning} />;
}
