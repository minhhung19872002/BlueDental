import { HistoryOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

/** What the panel becomes when the week and filters leave nothing to list. */
export function HistoryEmpty() {
  return (
    <div className="ah-empty-card" data-testid="ah-empty">
      <HistoryOutlined className="ah-empty-icon" />
      <div className="ah-empty-title">{t("Không có lịch sử thay đổi")}</div>
      <div className="ah-empty-hint">
        {t("Thử điều chỉnh khoảng thời gian hoặc bỏ bộ lọc để xem thêm thao tác.")}
      </div>
    </div>
  );
}
