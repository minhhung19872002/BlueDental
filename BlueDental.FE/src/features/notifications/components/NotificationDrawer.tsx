// NotificationDrawer — real-time notifications via SignalR.
// TODO: Connect to createNotificationConnection() from lib/signalr.ts.

import { Drawer, Empty } from "antd";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Thông báo"
      placement="right"
      width={380}
    >
      <Empty description="Không có thông báo mới" />
    </Drawer>
  );
}
