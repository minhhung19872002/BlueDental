import React from "react";
import { Input, Segmented } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { t } from "@/lib/i18n";

type ViewMode = DateNavigatorMode;

interface ReceptionToolbarProps {
  keyword?: string;
  viewMode?: ViewMode;
  currentDate?: Dayjs;
  onSearchChange: (value: string) => void;
  onDoctorSelect: (doctorId: string | undefined) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onDateChange?: (date: Dayjs) => void;
}

export const ReceptionToolbar: React.FC<ReceptionToolbarProps> = ({
  keyword = "",
  viewMode = "day",
  currentDate,
  onSearchChange,
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

  const viewOptions = [t("Ngày"), t("Tuần"), t("Tháng")];

  return (
    <div className="reception-toolbar">
      <div className="reception-toolbar-left">
        <Segmented
          value={viewModeToLabel(viewMode)}
          onChange={(val) => onViewModeChange?.(labelToViewMode(val as string))}
          options={viewOptions}
          style={{ flexShrink: 0 }}
        />

        <DateNavigator
          value={date}
          mode={viewMode}
          onChange={(d) => onDateChange?.(d)}
        />

        <Input
          placeholder={t("Tìm bệnh nhân...")}
          prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 160 }}
        />
      </div>
    </div>
  );
};
