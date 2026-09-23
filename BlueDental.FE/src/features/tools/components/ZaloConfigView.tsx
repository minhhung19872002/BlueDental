import { Button, Tag } from "antd";
import { t } from "@/lib/i18n";

/** The reference's Zalo OA panel: not connected, and nothing to connect yet. */
export function ZaloConfigView() {
  return (
    <div className="reception-card reception-card--content">
      <div className="bd-zalo-panel">
        <div className="bd-zalo-avatar">OA</div>
        <div>
          <div className="bd-zalo-title">{t("Tools:ZaloNotConnected")}</div>
          <Tag color="default" className="bd-zalo-status">
            {t("Tools:ZaloNotActivated")}
          </Tag>
          <div>
            <Button type="primary" disabled>
              {t("Tools:ZaloConnect")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

