import { PillTabs } from "@/components/PillTabs";
import type { CalendarTab } from "../hooks/useCalendarState";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";

interface Props {
  activeTab: CalendarTab;
  onChange: (tab: CalendarTab) => void;
}

export function CalendarUnderlineTabs({ activeTab, onChange }: Props) {
  const workScheduleAbility = useAbility("workSchedule");

  const items = [
    { key: "customer", label: t("Lịch hẹn khách hàng") },
    ...(workScheduleAbility.canRead ? [{ key: "work", label: t("Lịch làm việc") }] : []),
  ];

  return (
    <div className="cal-tabs-wrap">
      <PillTabs
        items={items}
        activeKey={activeTab}
        onChange={(key) => onChange(key as CalendarTab)}
      />
    </div>
  );
}
