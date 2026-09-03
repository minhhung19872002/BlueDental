import { Button, Input, Select } from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
  PlusOutlined,
  MenuOutlined,
  ExpandOutlined,
} from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import type { ViewMode } from "../hooks/useCalendarState";
import { t } from "@/lib/i18n";

interface Props {
  keyword: string;
  onKeywordChange: (v: string) => void;
  doctorIds: string[];
  onDoctorChange: (v: string[]) => void;
  doctors: { id: string; name: string }[];
  viewMode: ViewMode;
  slotMinutes: 15 | 30;
  onToggleSlot: () => void;
  onExport: () => void;
  onCreateAppointment: () => void;
  onCreateTemp: () => void;
  onFullscreen: () => void;
}

export function CalendarToolbarRow2({
  keyword,
  onKeywordChange,
  doctorIds,
  onDoctorChange,
  doctors,
  viewMode,
  slotMinutes,
  onToggleSlot,
  onExport,
  onCreateAppointment,
  onCreateTemp,
  onFullscreen,
}: Props) {
  const isMonthView = viewMode === "month";
  const slotTitle = isMonthView
    ? t("Chỉ khả dụng ở chế độ Ngày/Tuần")
    : slotMinutes === 30
      ? t("Xem theo giờ")
      : t("Xem theo bác sĩ");

  return (
    <div className="cal-toolbar-row2">
      <div className="cal-toolbar-row2-left">
        <div className="cal-search-field">
          <FloatingLabel label={t("Tìm kiếm")} floated={Boolean(keyword)}>
            <Input
              prefix={<SearchOutlined style={{ color: "#99a0bd" }} />}
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
          </FloatingLabel>
        </div>
        <div className="cal-doctor-field">
          <FloatingLabel label={t("Bác sĩ")} floated={doctorIds.length > 0}>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              value={doctorIds}
              onChange={onDoctorChange}
              style={{ minWidth: 280 }}
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
            />
          </FloatingLabel>
        </div>
        {/* Slot toggle — visible only on mobile, next to doctor field */}
        <Button
          className="cal-btn-slot cal-btn-slot--mobile"
          icon={<MenuOutlined />}
          type={slotMinutes === 15 ? "primary" : "default"}
          ghost={slotMinutes === 15}
          title={slotTitle}
          disabled={isMonthView}
          onClick={onToggleSlot}
        />
      </div>
      <div className="cal-toolbar-row2-right">
        <Button className="cal-btn-export" icon={<DownloadOutlined />} onClick={onExport}>
          {t("Xuất File")}
        </Button>
        <Button className="cal-btn-create" type="primary" icon={<PlusOutlined />} onClick={onCreateAppointment}>
          {t("Tạo lịch hẹn mới")}
        </Button>
        <Button className="cal-btn-temp" icon={<PlusOutlined />} onClick={onCreateTemp}>
          {t("Tạo lịch tạm")}
        </Button>
        {/* Slot toggle — visible only on desktop */}
        <Button
          className="cal-btn-slot cal-btn-slot--desktop"
          icon={<MenuOutlined />}
          type={slotMinutes === 15 ? "primary" : "default"}
          ghost={slotMinutes === 15}
          title={slotTitle}
          disabled={isMonthView}
          onClick={onToggleSlot}
        />
        <Button
          className="cal-btn-fullscreen"
          icon={<ExpandOutlined />}
          title={t("Toàn màn hình")}
          onClick={onFullscreen}
        />
      </div>
    </div>
  );
}
