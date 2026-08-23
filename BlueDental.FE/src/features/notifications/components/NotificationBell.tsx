import { useState } from "react";
import { Badge, Button } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { NotificationDrawer } from "./NotificationDrawer";
import { t } from "@/lib/i18n";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  // TODO: Wire to notification count query
  const unreadCount = 0;

  return (
    <>
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          onClick={() => setOpen(true)}
          aria-label={t("Thông báo")}
        />
      </Badge>

      <NotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
