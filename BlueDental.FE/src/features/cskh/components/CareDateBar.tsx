import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import type { CareDateMode } from "../careTabs";

const MODES: readonly { key: CareDateMode; label: () => string }[] = [
  { key: "day", label: () => t("Ngày") },
  { key: "week", label: () => t("Tuần") },
  { key: "month", label: () => t("Tháng") },
];

interface CareDateBarProps {
  mode: CareDateMode;
  date: Dayjs;
  onModeChange: (mode: CareDateMode) => void;
  onDateChange: (date: Dayjs) => void;
}

/** Ngày / Tuần / Tháng pills plus the prev-label-next date navigator. */
export function CareDateBar({ mode, date, onModeChange, onDateChange }: CareDateBarProps) {
  return (
    <div className="cskh-datebar">
      <SegmentedTabs
        items={MODES.map((item) => ({ key: item.key, label: item.label() }))}
        activeKey={mode}
        onChange={onModeChange}
      />
      <DateNavigator value={date} mode={mode} onChange={onDateChange} />
    </div>
  );
}
