import React from "react";
import { Button, Input, Segmented } from "antd";
import { SearchOutlined, FormOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { t } from "@/lib/i18n";

/**
 * The three periods this toolbar offers. `DateNavigator` also knows how to step
 * a year, but Tiếp nhận has no year button — and the mode travels on to
 * `useReceptionMetrics`, so a value the Segmented cannot produce must not be
 * declarable here either. Add "Năm" to `viewOptions` and this alias together.
 */
type ViewMode = Exclude<DateNavigatorMode, "year">;

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
    if (mode === "day") return t("Common:Day");
    if (mode === "week") return t("Common:Week");
    return t("Common:Month");
  };

  const labelToViewMode = (label: string): ViewMode => {
    if (label === t("Common:Day")) return "day";
    if (label === t("Common:Week")) return "week";
    return "month";
  };

  const viewOptions = [t("Common:Day"), t("Common:Week"), t("Common:Month")];

  return (
    <div className="reception-toolbar-wrap">
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
            className="reception-toolbar-search--inline"
            placeholder={t("Reception:SearchPlaceholder")}
            prefix={<SearchOutlined style={{ color: "#99a0bd" }} />}
            value={keyword}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
            style={{ flex: 1, minWidth: 160 }}
          />
        </div>

        <div className="reception-toolbar-right">
          {onCreateClick && (
            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={onCreateClick}
            >
              {t("Reception:CreateTitle")}
            </Button>
          )}
        </div>
      </div>

      <Input
        className="reception-toolbar-search--block"
        placeholder={t("Reception:SearchPlaceholder")}
        prefix={<SearchOutlined style={{ color: "#99a0bd" }} />}
        value={keyword}
        onChange={(e) => onSearchChange(e.target.value)}
        allowClear
      />
    </div>
  );
};
