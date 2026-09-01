import { useRef } from "react";
import { Button, Input, Select, Segmented } from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import type { ViewMode } from "../hooks/useCalendarState";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

const STATUS_CHIPS = [
  { key: "scheduled", label: () => t("Đã hẹn"), bg: "#eceefd", border: "#c8cafa", color: "#6366f1" },
  { key: "arrived", label: () => t("Đã đến"), bg: "#e2f4ee", border: "#abddcc", color: "#0e9f6e" },
  { key: "cancelled", label: () => t("Huỷ hẹn"), bg: "#faf1e2", border: "#f2d6ab", color: "#d98b0f" },
  { key: "late", label: () => t("Trễ hẹn"), bg: "#fce9ea", border: "#f6bfc1", color: "#e5484d" },
  { key: "temporary", label: () => t("Lịch tạm"), bg: "#efebfb", border: "#d1c6f4", color: "#7c5ce0" },
  { key: "converted", label: () => t("Chuyển đổi"), bg: "#e2f2f9", border: "#abd9ee", color: "#0e94d0" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  currentDate: Dayjs;
  onDateChange: (date: Dayjs) => void;
  onNavigate: (dir: -1 | 1) => void;
  slotMinutes: 15 | 30;
  onToggleSlot: () => void;
  onCreateAppointment: () => void;
  onCreateTemp: () => void;
  onExport: () => void;
  keyword: string;
  onKeywordChange: (v: string) => void;
  doctorIds: string[];
  onDoctorChange: (v: string[]) => void;
  doctors: { id: string; name: string }[];
  counts: Map<string, number>;
  statusFilter?: string;
  onStatusToggle: (key: string) => void;
  filterCount: number;
  onClearFilters: () => void;
}

export function CalendarControlPanel({
  open,
  onClose,
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
  slotMinutes,
  onToggleSlot,
  onCreateAppointment,
  onCreateTemp,
  onExport,
  keyword,
  onKeywordChange,
  doctorIds,
  onDoctorChange,
  doctors,
  counts,
  statusFilter,
  onStatusToggle,
  filterCount,
  onClearFilters,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div className="cal-panel-overlay" onClick={handleOverlayClick}>
      <div className="cal-panel" ref={panelRef}>
        <div className="cal-panel-header">
          <div className="cal-panel-header-left">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
            </svg>
            <span className="cal-panel-title">{t("Bảng điều khiển")}</span>
          </div>
          <button type="button" className="cal-panel-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="cal-panel-body">
          <div className="cal-panel-section cal-panel-section--bordered" style={{ minWidth: 480 }}>
            <label className="cal-panel-section-label">{t("Thời gian")}</label>
            <div className="cal-panel-section-content">
              <div className="cal-panel-row">
                <Segmented
                  value={viewMode}
                  onChange={(v) => onViewModeChange(v as ViewMode)}
                  options={[
                    { label: t("Ngày"), value: "day" },
                    { label: t("Tuần"), value: "week" },
                    { label: t("Tháng"), value: "month" },
                  ]}
                />
                <DateNavigator
                  value={currentDate}
                  mode={viewMode}
                  onChange={onDateChange}
                />
              </div>
            </div>
          </div>

          <div className="cal-panel-section cal-panel-section--bordered" style={{ minWidth: 220 }}>
            <label className="cal-panel-section-label">{t("Chế độ xem")}</label>
            <div className="cal-panel-section-content">
              <Segmented
                value={slotMinutes === 15 ? "hour" : "doctor"}
                onChange={(v) => {
                  if ((v === "hour" && slotMinutes !== 15) || (v === "doctor" && slotMinutes !== 30)) {
                    onToggleSlot();
                  }
                }}
                options={[
                  { label: t("Theo giờ"), value: "hour" },
                  { label: t("Theo bác sĩ"), value: "doctor" },
                ]}
                disabled={viewMode === "month"}
              />
            </div>
          </div>

          <div className="cal-panel-section cal-panel-section--bordered" style={{ minWidth: 220 }}>
            <label className="cal-panel-section-label">{t("Thao tác")}</label>
            <div className="cal-panel-actions">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { onClose(); onCreateAppointment(); }} block>
                {t("Tạo lịch hẹn mới")}
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => { onClose(); onCreateTemp(); }} block>
                {t("Tạo lịch tạm")}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => { onClose(); onExport(); }} block>
                {t("Xuất File")}
              </Button>
            </div>
          </div>

          <div className="cal-panel-section cal-panel-section--filter" style={{ minWidth: 420, flex: 2 }}>
            <label className="cal-panel-section-label">{t("Bộ lọc")}</label>
            <div className="cal-panel-filters">
              <div className="cal-panel-filter-row">
                <div className="cal-panel-filter-field">
                  <span className="cal-panel-filter-label">{t("Tìm kiếm")}</span>
                  <Input
                    prefix={<SearchOutlined style={{ color: "#99a0bd" }} />}
                    value={keyword}
                    onChange={(e) => onKeywordChange(e.target.value)}
                    allowClear
                    placeholder={t("Tìm kiếm theo tên, SĐT...")}
                  />
                </div>
                <div className="cal-panel-filter-field">
                  <span className="cal-panel-filter-label">{t("Bác sĩ điều trị")}</span>
                  <Select
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    value={doctorIds}
                    onChange={onDoctorChange}
                    placeholder={t("Chọn bác sĩ")}
                    style={{ width: "100%" }}
                    options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                    getPopupContainer={(trigger) => trigger.closest(".cal-panel") ?? document.body}
                  />
                </div>
              </div>
              <div className="cal-panel-status-section">
                <span className="cal-panel-filter-label">{t("Trạng thái")}</span>
                <div className="cal-panel-chips">
                  {STATUS_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={[
                        "cal-panel-chip",
                        statusFilter === c.key && "cal-panel-chip--active",
                      ].filter(Boolean).join(" ")}
                      style={{
                        "--chip-bg": c.bg,
                        "--chip-border": c.border,
                        "--chip-color": c.color,
                      } as React.CSSProperties}
                      onClick={() => onStatusToggle(c.key)}
                    >
                      {c.label()} ({counts.get(c.key) ?? 0})
                    </button>
                  ))}
                </div>
              </div>

              {filterCount > 0 && (
                <div className="cal-panel-clear-row">
                  <Button danger icon={<DeleteOutlined />} onClick={onClearFilters}>
                    {t("Xoá bộ lọc")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
