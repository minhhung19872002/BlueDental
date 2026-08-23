import React from "react";
import { Input, Button, Segmented } from "antd";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const date = currentDate ?? dayjs();

  const viewModeToLabel = (mode: ViewMode): string => {
    if (mode === "day") return t("common.day");
    if (mode === "week") return t("common.week");
    return t("common.month");
  };

  const labelToViewMode = (label: string): ViewMode => {
    if (label === t("common.day")) return "day";
    if (label === t("common.week")) return "week";
    return "month";
  };

  const formatDateDisplay = (d: Dayjs, mode: ViewMode): string => {
    if (mode === "day") return d.format("DD/MM/YYYY");
    if (mode === "week") {
      const start = d.startOf("week").format("DD/MM");
      const end = d.endOf("week").format("DD/MM/YYYY");
      return `${start} - ${end}`;
    }
    return t("reception.toolbar.monthLabel", {
      month: d.format("MM"),
      year: d.format("YYYY"),
    });
  };

  const viewOptions = [t("common.day"), t("common.week"), t("common.month")];

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
          placeholder={t("reception.toolbar.searchPlaceholder")}
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
          {t("reception.toolbar.createButton")}
        </Button>
      </div>
    </div>
  );
};
