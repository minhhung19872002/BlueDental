// RevenueSummaryCard — shows today's collected revenue.
// TODO: Wire to billing API when available.

import { DollarOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";

export function RevenueSummaryCard() {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">Doanh thu hôm nay</div>
          <div className="stat-card-value">—</div>
        </div>
        <div
          className="stat-card-icon"
          style={{ background: "#E8F5E9", color: brand.green }}
        >
          <DollarOutlined />
        </div>
      </div>
      <div className="stat-card-footer">Đang phát triển</div>
    </div>
  );
}
