// RevenueSummaryCard — shows today's collected revenue.
// TODO: Wire to billing API when available.

import { DollarOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

export function RevenueSummaryCard() {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">{t("Doanh thu hôm nay")}</div>
          <div className="stat-card-value">—</div>
        </div>
        <div
          className="stat-card-icon"
          style={{ background: "#E8F5E9", color: brand.green }}
        >
          <DollarOutlined />
        </div>
      </div>
      <div className="stat-card-footer">{t("Đang phát triển")}</div>
    </div>
  );
}
