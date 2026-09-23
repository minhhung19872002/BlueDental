import { HistoryOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

/** What the panel becomes when the week and filters leave nothing to list. */
export function HistoryEmpty() {
  return (
    <div className="ah-empty-card" data-testid="ah-empty">
      <HistoryOutlined className="ah-empty-icon" />
      <div className="ah-empty-title">{t("Appointment:History:EmptyTitle")}</div>
      <div className="ah-empty-hint">
        {t("Appointment:History:EmptyHint")}
      </div>
    </div>
  );
}
