import React from "react";
import { Input, Button, Segmented } from "antd";
import {
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  FormOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";

interface DoctorOption {
  id: string;
  name: string;
  title: string;
}

type ViewMode = "day" | "week" | "month";

interface ReceptionToolbarProps {
  keyword?: string;
  selectedDoctorId?: string;
  doctors?: DoctorOption[];
  viewMode?: ViewMode;
  currentDate?: Dayjs;
  onSearchChange: (value: string) => void;
  onDoctorSelect: (doctorId: string | undefined) => void;
  onCreateClick: () => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onDateChange?: (date: Dayjs) => void;
}

const VIEW_OPTIONS = ["Ngày", "Tuần", "Tháng"] as const;

function viewModeToLabel(mode: ViewMode): string {
  if (mode === "day") return "Ngày";
  if (mode === "week") return "Tuần";
  return "Tháng";
}

function labelToViewMode(label: string): ViewMode {
  if (label === "Ngày") return "day";
  if (label === "Tuần") return "week";
  return "month";
}

function formatDateDisplay(date: Dayjs, mode: ViewMode): string {
  if (mode === "day") return date.format("DD/MM/YYYY");
  if (mode === "week") {
    const start = date.startOf("week").format("DD/MM");
    const end = date.endOf("week").format("DD/MM/YYYY");
    return `${start} - ${end}`;
  }
  return `Tháng ${date.format("MM/YYYY")}`;
}

function stepDate(date: Dayjs, mode: ViewMode, direction: 1 | -1): Dayjs {
  const unit = mode === "day" ? "day" : mode === "week" ? "week" : "month";
  return direction === 1 ? date.add(1, unit) : date.subtract(1, unit);
}

export const ReceptionToolbar: React.FC<ReceptionToolbarProps> = ({
  keyword = "",
  viewMode = "day",
  currentDate,
  onSearchChange,
  onCreateClick,
  onViewModeChange,
  onDateChange,
}) => {
  const date = currentDate ?? dayjs();

  return (
    <div className="reception-toolbar">
      {/* Left: time tabs + date nav + search */}
      <div className="reception-toolbar-left">
        <Segmented
          value={viewModeToLabel(viewMode)}
          onChange={(val) => onViewModeChange?.(labelToViewMode(val as string))}
          options={[...VIEW_OPTIONS]}
          style={{ fontWeight: 600 }}
        />

        <div className="reception-toolbar-date-nav">
          <Button
            size="small"
            icon={<LeftOutlined style={{ fontSize: 11 }} />}
            onClick={() => onDateChange?.(stepDate(date, viewMode, -1))}
          />
          <button type="button" className="reception-toolbar-date-display">
            <CalendarOutlined style={{ fontSize: 13 }} />
            {formatDateDisplay(date, viewMode)}
          </button>
          <Button
            size="small"
            icon={<RightOutlined style={{ fontSize: 11 }} />}
            onClick={() => onDateChange?.(stepDate(date, viewMode, 1))}
          />
        </div>

        <Input
          placeholder="Nhập từ khoá tìm kiếm"
          prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: 220, height: 36 }}
        />
      </div>

      {/* Right: create button */}
      <div className="reception-toolbar-right">
        <Button
          type="primary"
          icon={<FormOutlined />}
          onClick={onCreateClick}
          style={{
            height: 36,
            fontWeight: 600,
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          Tạo tiếp nhận
        </Button>
      </div>
    </div>
  );
};
