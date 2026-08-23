// PendingActionsCard — shows items requiring attention (unpaid invoices, follow-ups, etc.)
// TODO: Wire to respective APIs when available.

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

export function PendingActionsCard() {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">{t("Cần xử lý")}</div>
          <div className="stat-card-value">—</div>
        </div>
        <div
          className="stat-card-icon"
          style={{ background: "#FFF3E0", color: brand.amber }}
        >
          <ExclamationCircleOutlined />
        </div>
      </div>
      <div className="stat-card-footer">{t("Đang phát triển")}</div>
    </div>
  );
}
