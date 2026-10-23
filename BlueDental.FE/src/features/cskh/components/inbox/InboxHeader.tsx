import { Button } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { INBOX_LIMITS } from "../../api/inboxApi";
import { WAIT_AMBER_MINUTES, WAIT_RED_MINUTES } from "../../inboxLook";

interface Props {
  oaName: string | null;
  connected: boolean;
  meName: string | null;
  syncing: boolean;
  onSync: () => void;
}

/** "Hộp thư Zalo · OA … · Bạn: …" and the legend of the hold and the wait colours (BA P2210). */
export function InboxHeader({ oaName, connected, meName, syncing, onSync }: Props) {
  return (
    <div className="ibx-head">
      <div className="ibx-head-title">
        <h2 className="ibx-title">{t("CSKH:Tab:Inbox")}</h2>
        <span className="ibx-head-sub">
          {[connected && oaName ? t("CSKH:Inbox:Oa", oaName) : t("CSKH:Inbox:NotConnected"), meName && t("CSKH:Inbox:You", meName)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="ibx-legend">
        <span className="ibx-legend-chip">{t("CSKH:Inbox:Legend:Hold", INBOX_LIMITS.holdMinutes)}</span>
        <span className="ibx-legend-chip ibx-legend-chip--amber">{t("CSKH:Inbox:Legend:Amber", WAIT_AMBER_MINUTES)}</span>
        <span className="ibx-legend-chip ibx-legend-chip--red">{t("CSKH:Inbox:Legend:Red", WAIT_RED_MINUTES)}</span>
        <Button size="small" icon={<SyncOutlined spin={syncing} />} disabled={!connected || syncing} onClick={onSync}>
          {t("CSKH:Inbox:Sync")}
        </Button>
      </div>
    </div>
  );
}
