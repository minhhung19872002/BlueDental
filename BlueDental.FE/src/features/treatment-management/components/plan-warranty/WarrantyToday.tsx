import { t } from "@/lib/i18n";
import { formatCardDate } from "@/features/labo/components/warranty/laboWarrantyRules";

/** "Hôm nay: 06/11/2026" at the right of the breadcrumb (m366): the clinic's day the tab counts from. */
export function WarrantyToday({ today }: { today: string }) {
  return <span className="pwt-today">{t("Treatment:Warranty:Today", formatCardDate(today))}</span>;
}
