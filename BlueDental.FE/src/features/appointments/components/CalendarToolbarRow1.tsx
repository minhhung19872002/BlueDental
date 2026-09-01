import { Segmented } from "antd";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { CalendarStatusCounters } from "./CalendarStatusCounters";
import type { ViewMode } from "../hooks/useCalendarState";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  currentDate: Dayjs;
  onDateChange: (date: Dayjs) => void;
  onNavigate: (dir: -1 | 1) => void;
  counts: Map<string, number>;
  statusFilter?: string;
  onStatusToggle: (key: string) => void;
}

export function CalendarToolbarRow1({
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
  counts,
  statusFilter,
  onStatusToggle,
}: Props) {
  return (
    <div className="cal-toolbar-row1">
      <div className="cal-toolbar-left">
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
      <CalendarStatusCounters
        counts={counts}
        activeKey={statusFilter}
        onToggle={onStatusToggle}
      />
    </div>
  );
}
