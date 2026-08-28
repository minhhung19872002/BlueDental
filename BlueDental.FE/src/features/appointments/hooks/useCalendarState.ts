import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";

export type ViewMode = "day" | "week" | "month";
export type CalendarTab = "customer" | "work";

export function useCalendarState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const topTab: CalendarTab =
    searchParams.get("tab") === "timekeeping" ? "work" : "customer";

  const setTopTab = (key: CalendarTab) => {
    setSearchParams((params) => {
      if (key === "work") params.set("tab", "timekeeping");
      else params.delete("tab");
      return params;
    });
  };

  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const currentDate = dayjs(searchParams.get("date") ?? undefined);

  const setCurrentDate = (updater: (d: Dayjs) => Dayjs) => {
    setSearchParams((params) => {
      params.set(
        "date",
        updater(dayjs(params.get("date") ?? undefined)).format("YYYY-MM-DD"),
      );
      return params;
    });
  };

  const navigateDate = (dir: -1 | 1) => {
    const unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month";
    setCurrentDate((d) => d.add(dir, unit));
  };

  return {
    topTab,
    setTopTab,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    navigateDate,
  };
}
