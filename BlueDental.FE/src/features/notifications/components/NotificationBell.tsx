import { useNavigate } from "react-router-dom";

import { useT } from "@/lib/i18n";
import { brand } from "@/theme/index";

import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from "../api";
import { NotificationType, type NotificationViewModel } from "../types";

/** Each kind gets its own mark and tint, so the list reads before it is read. */
const ICON_BY_TYPE: Record<NotificationType, { d: string; ink: string }> = {
  [NotificationType.AppointmentReminder]: {
    d: "M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
    ink: brand.info,
  },
  [NotificationType.AppointmentConfirmation]: {
    d: "M20 6L9 17l-5-5",
    ink: brand.green,
  },
  [NotificationType.AppointmentCancellation]: {
    d: "M18 6L6 18M6 6l12 12",
    ink: brand.red,
  },
  [NotificationType.TreatmentPlanApproval]: {
    d: "M12 21s-6-4.5-6-9a4 4 0 018-1 4 4 0 018 1c0 4.5-6 9-6 9z",
    ink: brand.purple,
  },
  [NotificationType.InvoiceIssued]: {
    d: "M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm4 8h4",
    ink: brand.info,
  },
  [NotificationType.PaymentReceived]: {
    d: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    ink: brand.green,
  },
  [NotificationType.InsuranceClaimUpdate]: {
    d: "M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z",
    ink: brand.purple,
  },
  [NotificationType.StockAlert]: {
    d: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8",
    ink: brand.amber,
  },
  [NotificationType.SystemAlert]: {
    d: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
    ink: brand.primary,
  },
};

interface Props {
  open: boolean;
  /** Opens the panel, or leaves it open — closing goes through `onClose`. */
  onOpen: () => void;
  onClose: () => void;
}

/**
 * The header's bell and the panel under it.
 *
 * The panel is positioned rather than an Ant Design popover so it can carry the
 * design's own 372px card, and so the one sheet that closes the group ribbon
 * closes this too.
 */
export function NotificationBell({ open, onOpen, onClose }: Props) {
  const t = useT();
  const navigate = useNavigate();

  const { data, isLoading } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleOpen = () => {
    if (open) onClose();
    else onOpen();
  };

  const handleSelect = (item: NotificationViewModel) => {
    if (!item.isRead) markRead.mutate(item.id);
    onClose();
    if (item.route) navigate(item.route);
  };

  return (
    <div className="app-header-bell">
      <button
        type="button"
        className="app-header-icon-btn"
        aria-label={t("Thông báo")}
        aria-expanded={open}
        onClick={handleOpen}
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="app-header-notif-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="app-notif-panel" role="dialog" aria-label={t("Thông báo")}>
          <div className="app-notif-head">
            <span className="app-notif-title">{t("Thông báo")}</span>
            <button
              type="button"
              className="app-notif-readall"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t("Đánh dấu đã đọc")}
            </button>
          </div>

          <div className="app-notif-list">
            {isLoading && <div className="app-notif-empty">{t("Đang tải…")}</div>}
            {!isLoading && items.length === 0 && (
              <div className="app-notif-empty">{t("Chưa có thông báo nào")}</div>
            )}
            {items.map((item) => {
              const icon = ICON_BY_TYPE[item.type] ?? ICON_BY_TYPE[NotificationType.SystemAlert];
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`app-notif-item${item.isRead ? "" : " app-notif-item--unread"}`}
                  onClick={() => handleSelect(item)}
                >
                  <span
                    className="app-notif-icon"
                    style={
                      {
                        "--notif-ink": icon.ink,
                        "--notif-tint": `${icon.ink}1a`,
                      } as React.CSSProperties
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={icon.d} />
                    </svg>
                  </span>
                  <span className="app-notif-body">
                    <span className="app-notif-item-title">{item.title}</span>
                    <span className="app-notif-item-text">{item.body}</span>
                    {item.time && <span className="app-notif-item-time">{item.time}</span>}
                  </span>
                  {!item.isRead && <span className="app-notif-dot" />}
                </button>
              );
            })}
          </div>

          <button type="button" className="app-notif-close" onClick={onClose}>
            {t("Đóng")}
          </button>
        </div>
      )}
    </div>
  );
}
