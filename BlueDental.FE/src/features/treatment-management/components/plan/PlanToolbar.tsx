import { Eye, Plus } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  onCreate: () => void;
  onViewAll: () => void;
}

/** The two buttons above the summary cards: primary "Tạo kế hoạch mới", tinted "Xem tất cả dịch vụ". */
export function PlanToolbar({ onCreate, onViewAll }: Props) {
  return (
    <div className="tp-toolbar">
      <button type="button" className="tp-btn tp-btn--primary" onClick={onCreate}>
        <Plus size={16} aria-hidden="true" />
        {t("Tạo kế hoạch mới")}
      </button>
      <button type="button" className="tp-btn tp-btn--outline" onClick={onViewAll}>
        <Eye size={16} aria-hidden="true" />
        {t("Xem tất cả dịch vụ")}
      </button>
    </div>
  );
}
