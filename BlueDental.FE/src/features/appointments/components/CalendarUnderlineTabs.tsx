import { PillTabs } from "@/components/PillTabs";
import type { CalendarTab } from "../hooks/useCalendarState";
import { t } from "@/lib/i18n";

interface Props {
  activeTab: CalendarTab;
  onChange: (tab: CalendarTab) => void;
}

export function CalendarUnderlineTabs({ activeTab, onChange }: Props) {
  return (
    <div className="cal-tabs-wrap">
      <PillTabs
        items={[
          { key: "customer", label: t("Lịch hẹn khách hàng") },
          { key: "work", label: t("Lịch làm việc") },
        ]}
        activeKey={activeTab}
        onChange={(key) => onChange(key as CalendarTab)}
      />
    </div>
  );
}
