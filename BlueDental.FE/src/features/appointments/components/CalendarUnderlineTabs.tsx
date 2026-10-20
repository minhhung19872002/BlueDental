import type { ReactNode } from "react";
import { PillTabs } from "@/components/PillTabs";
import type { CalendarTab } from "../hooks/useCalendarState";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";

interface Props {
  activeTab: CalendarTab;
  onChange: (tab: CalendarTab) => void;
  /** The active tab's counters, at the far end of the tab row (BA R-999). */
  extra?: ReactNode;
}

export function CalendarUnderlineTabs({ activeTab, onChange, extra }: Props) {
  const workScheduleAbility = useAbility("workSchedule");

  const items = [
    { key: "customer", label: t("Appointment:Tab:CustomerCalendar") },
    ...(workScheduleAbility.canRead ? [{ key: "work", label: t("Appointment:Tab:WorkSchedule") }] : []),
  ];

  return (
    <div className="cal-tabs-wrap">
      <PillTabs
        items={items}
        activeKey={activeTab}
        onChange={(key) => onChange(key as CalendarTab)}
        extra={extra}
      />
    </div>
  );
}
