import { Segmented } from "antd";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import type { ViewMode } from "../hooks/useCalendarState";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  currentDate: Dayjs;
  onDateChange: (date: Dayjs) => void;
}

/** Ngày / Tuần / Tháng + the date picker, leading the filter row (BA R-999). */
export function CalendarViewControls({
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
}: Props) {
  return (
    <div className="cal-view-controls">
      <Segmented
        value={viewMode}
        onChange={(v) => onViewModeChange(v as ViewMode)}
        options={[
          { label: t("Common:Day"), value: "day" },
          { label: t("Common:Week"), value: "week" },
          { label: t("Common:Month"), value: "month" },
        ]}
      />
      <DateNavigator
        value={currentDate}
        mode={viewMode}
        onChange={onDateChange}
      />
    </div>
  );
}
