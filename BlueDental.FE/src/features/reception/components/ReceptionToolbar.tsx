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
import { t } from "@/lib/i18n";

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

  const viewModeToLabel = (mode: ViewMode): string => {
    if (mode === "day") return t("Ngày");
    if (mode === "week") return t("Tuần");
    return t("Tháng");
  };

  const labelToViewMode = (label: string): ViewMode => {
    if (label === t("Ngày")) return "day";
    if (label === t("Tuần")) return "week";
    return "month";
  };

  const formatDateDisplay = (d: Dayjs, mode: ViewMode): string => {
    if (mode === "day") return d.format("DD/MM/YYYY");
    if (mode === "week") {
      const start = d.startOf("week").format("DD/MM");
      const end = d.endOf("week").format("DD/MM/YYYY");
      return `${start} - ${end}`;
    }
    return t("Tháng {0}/{1}", d.format("MM"), d.format("YYYY"));
  };

  const viewOptions = [t("Ngày"), t("Tuần"), t("Tháng")];

  return (
    <div className="reception-toolbar">
      {/* Left: time tabs + date nav + search */}
      <div className="reception-toolbar-left">
        <Segmented
          value={viewModeToLabel(viewMode)}
          onChange={(val) => onViewModeChange?.(labelToViewMode(val as string))}
          options={viewOptions}
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
          placeholder={t("Tìm bệnh nhân...")}
          prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: 240, height: 38 }}
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
          {t("Tạo tiếp nhận")}
        </Button>
      </div>
    </div>
  );
};
