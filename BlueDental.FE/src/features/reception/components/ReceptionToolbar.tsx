import React from "react";
import { Button, Input, Segmented } from "antd";
import { SearchOutlined, FormOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { t } from "@/lib/i18n";

type ViewMode = DateNavigatorMode;

interface ReceptionToolbarProps {
  keyword?: string;
  viewMode?: ViewMode;
  currentDate?: Dayjs;
  onSearchChange: (value: string) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onDateChange?: (date: Dayjs) => void;
  onCreateClick?: () => void;
}

export const ReceptionToolbar: React.FC<ReceptionToolbarProps> = ({
  keyword = "",
  viewMode = "day",
  currentDate,
  onSearchChange,
  onViewModeChange,
  onDateChange,
  onCreateClick,
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

      <div className="reception-toolbar-right">
        <Button
          type="primary"
          icon={<FormOutlined />}
          onClick={onCreateClick}
        >
          {t("Tạo tiếp nhận")}
        </Button>
      </div>
    </div>
  );
};
