import { Button, Tag } from "antd";
import { t } from "@/lib/i18n";

/** The reference's Zalo OA panel: not connected, and nothing to connect yet. */
export function ZaloConfigView() {
  return (
    <div className="reception-card reception-card--content">
      <div className="bd-zalo-panel">
        <div className="bd-zalo-avatar">OA</div>
        <div>
          <div className="bd-zalo-title">{t("Chưa kết nối Zalo OA")}</div>
          <Tag color="default" className="bd-zalo-status">
            {t("Chưa kích hoạt")}
          </Tag>
          <div>
            <Button type="primary" disabled>
              {t("Kết nối Zalo OA")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
