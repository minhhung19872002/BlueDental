import { Eye } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  onViewAll: () => void;
}

/**
 * The strip above the summary cards: "Xem tất cả dịch vụ". "Tạo kế hoạch mới"
 * left it (owner 2026-10-15) — a service now goes onto a slip through
 * "Thêm dịch vụ phát sinh" on that slip's detail page.
 */
export function PlanToolbar({ onViewAll }: Props) {
  return (
    <div className="tp-toolbar">
      <button type="button" className="tp-btn tp-btn--outline" onClick={onViewAll}>
        <Eye size={16} aria-hidden="true" />
        {t("Treatment:Plan:ViewAllServices")}
      </button>
    </div>
  );
}
