// PendingActionsCard — shows items requiring attention (unpaid invoices, follow-ups, etc.)
// TODO: Wire to respective APIs when available.

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";

export function PendingActionsCard() {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">Cần xử lý</div>
          <div className="stat-card-value">—</div>
        </div>
        <div
          className="stat-card-icon"
          style={{ background: "#FFF3E0", color: brand.amber }}
        >
          <ExclamationCircleOutlined />
        </div>
      </div>
      <div className="stat-card-footer">Đang phát triển</div>
    </div>
  );
}
