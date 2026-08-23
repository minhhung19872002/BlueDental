// NotificationDrawer — real-time notifications via SignalR.
// TODO: Connect to createNotificationConnection() from lib/signalr.ts.

import { Drawer, Empty } from "antd";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("Thông báo")}
      placement="right"
      size={380}
    >
      <Empty description={t("Không có thông báo mới")} />
    </Drawer>
  );
}
