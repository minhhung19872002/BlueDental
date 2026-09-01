import React, { useCallback, useMemo } from "react";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";

interface StatusLook {
  border: string;
  bg: string;
  text: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

function hexToOpaqueTint(hex: string, alpha = 0.122): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mr = Math.round(r * alpha + 255 * (1 - alpha));
  const mg = Math.round(g * alpha + 255 * (1 - alpha));
  const mb = Math.round(b * alpha + 255 * (1 - alpha));
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
}

/*
 * The design's own statusColor map. Each fill is that colour at 0x1f over
 * white and stays fully opaque: a translucent card lets the calendar's grid
 * lines read straight through it.
 */
const STATUS_LOOK: Record<AppointmentStatus, StatusLook> = {
  scheduled: {
    border: "#6366f1",
    bg: "#eceefe",
    text: "#6366f1",
    badgeBg: "#eceefe",
    badgeBorder: "rgba(99,102,241,0.3)",
    badgeText: "#6366f1",
  },
  confirmed: {
    border: "#6366f1",
    bg: "#eceefe",
    text: "#6366f1",
    badgeBg: "#eceefe",
    badgeBorder: "rgba(99,102,241,0.3)",
    badgeText: "#6366f1",
  },
  inProgress: {
    border: "#6366f1",
    bg: "#eceefe",
    text: "#6366f1",
    badgeBg: "#eceefe",
    badgeBorder: "rgba(99,102,241,0.3)",
    badgeText: "#6366f1",
  },
  completed: {
    border: "#0e9f6e",
    bg: "#e7f6f1",
    text: "#0e9f6e",
    badgeBg: "#e7f6f1",
    badgeBorder: "rgba(14,159,110,0.3)",
    badgeText: "#0e9f6e",
  },
  cancelled: {
    border: "#d98b0f",
    bg: "#fbf3e4",
    text: "#d98b0f",
    badgeBg: "#fbf3e4",
    badgeBorder: "rgba(217,139,15,0.3)",
    badgeText: "#d98b0f",
  },
  noShow: {
    border: "#e5484d",
    bg: "#fdeef0",
    text: "#e5484d",
    badgeBg: "#fdeef0",
    badgeBorder: "rgba(229,72,77,0.3)",
    badgeText: "#e5484d",
  },
};

const BADGE_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Đã hẹn",
  confirmed: "Đã xác nhận",
  inProgress: "Đang khám",
  completed: "Hoàn tất",
  cancelled: "Huỷ hẹn",
  noShow: "Trễ hẹn",
};

interface EventCardProps {
  appointment: AppointmentDto;
  selected?: boolean;
  onAction?: (action: string, id: string) => void;
}

export const EventCard = React.memo(function EventCard({
  appointment,
  selected,
  onAction,
}: EventCardProps) {
  const navigate = useNavigate();
  const baseLook = STATUS_LOOK[appointment.status];
  const customColor = appointment.color;
  const look = customColor
    ? { ...baseLook, border: customColor, bg: hexToOpaqueTint(customColor), text: customColor }
    : baseLook;
  const patientName = appointment.patientName?.trim() || t("Lịch hẹn");
  const displayLabel = appointment.patientCode
    ? `[${appointment.patientCode}] - ${patientName}`
    : patientName;
  const start = dayjs(appointment.startTime);
  const end = dayjs(appointment.endTime);
  const durationMinutes = end.diff(start, "minute");
  const timeLabel = `${start.format("HH:mm")} - ${end.format("HH:mm")} (${durationMinutes} phút)`;

  const menuItems: MenuProps["items"] = useMemo(() => [
    {
      key: "edit",
      label: t("Cập nhật"),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    selected
      ? {
          key: "deselect",
          label: t("Bỏ chọn"),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <polyline points="9 11 12 14 22 4" />
            </svg>
          ),
        }
      : {
          key: "select-delete",
          label: t("Chọn để xoá nhiều"),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          ),
        },
    {
      key: "delete",
      label: t("Xoá"),
      danger: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
  ], [selected]);

  const handleMenuClick = useCallback<NonNullable<MenuProps["onClick"]>>((info) => {
    info.domEvent.stopPropagation();
    onAction?.(info.key, appointment.id);
  }, [onAction, appointment.id]);

  const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";
  const canNavigateToPatient = !appointment.isTemporary
    && appointment.patientId
    && appointment.patientId !== EMPTY_GUID;

  const handlePatientClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNavigateToPatient) {
      navigate(`/patient/${appointment.patientId}`);
    }
  }, [navigate, appointment.patientId, canNavigateToPatient]);

  return (
    <div
      className={["evt-card", selected && "evt-card--selected"].filter(Boolean).join(" ")}
      style={{
        "--evt-border": look.border,
        "--evt-bg": look.bg,
        "--evt-text": look.text,
      } as React.CSSProperties}
    >
      {/* Row 1: [CODE] - Patient name + ⋮ menu */}
      <div className="evt-card-row1">
        {canNavigateToPatient ? (
          <a
            className="evt-card-title"
            onClick={handlePatientClick}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePatientClick(e as unknown as React.MouseEvent);
              }
            }}
          >
            {displayLabel}
          </a>
        ) : (
          <span className="evt-card-title evt-card-title--static">{displayLabel}</span>
        )}
        <Dropdown
          menu={{ items: menuItems, onClick: handleMenuClick }}
          trigger={["click"]}
          placement="bottomRight"
          overlayClassName="evt-card-dropdown"
        >
          <button
            type="button"
            className="evt-card-menu"
            onClick={(e) => e.stopPropagation()}
            aria-label={t("Thêm")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </Dropdown>
      </div>

      {/* Row 2: Service/reason */}
      <div className="evt-card-row">
        <span className="evt-card-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </span>
        <span className="evt-card-label">{appointment.reason || "—"}</span>
      </div>

      {/* Row 3: Time range */}
      <div className="evt-card-row">
        <span className="evt-card-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="evt-card-label">{timeLabel}</span>
      </div>

      {/* Row 4: Status badge */}
      <div>
        <span
          className={`evt-card-badge evt-card-badge--${appointment.status}`}
          style={{
            "--badge-bg": look.badgeBg,
            "--badge-border": look.badgeBorder,
            "--badge-text": look.badgeText,
          } as React.CSSProperties}
        >
          {BADGE_LABEL[appointment.status]}
        </span>
      </div>

      {/* Row 5: Creator (doctor/admin) */}
      <div className="evt-card-row evt-card-creator">
        <span className="evt-card-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className="evt-card-label">{appointment.doctorName || "Admin"}</span>
      </div>
    </div>
  );
});

export const CARD_LOOK: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  scheduled:  { bg: "#E3F2FD", border: "#1565C0", text: "#1565C0" },
  confirmed:  { bg: "#E3F2FD", border: "#1565C0", text: "#1565C0" },
  inProgress: { bg: "#E8F5E9", border: "#2E7D32", text: "#2E7D32" },
  completed:  { bg: "#E8F5E9", border: "#16A34A", text: "#16A34A" },
  cancelled:  { bg: "#FEE2E2", border: "#EF4444", text: "#EF4444" },
  noShow:     { bg: "#FBF1DA", border: "#C08A1B", text: "#C08A1B" },
};
