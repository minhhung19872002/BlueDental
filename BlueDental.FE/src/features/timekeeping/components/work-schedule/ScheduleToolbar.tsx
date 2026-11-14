import type { ReactNode } from "react";
import { Button, Input } from "antd";
import { LeftOutlined, RightOutlined, SearchOutlined } from "@ant-design/icons";
import { SegmentedTabs } from "@/components/SegmentedTabs/SegmentedTabs";
import { t } from "@/lib/i18n";
import type { ScheduleFilters } from "../../hooks/useScheduleFilters";
import type { ScheduleGroupVm, ScheduleView } from "../../types/workSchedule";
import { TeamFilterDropdown } from "./TeamFilterDropdown";

export type MonthStep = -1 | 1 | "today";

interface Props {
  view: ScheduleView;
  onViewChange: (view: ScheduleView) => void;
  year: number;
  month: number;
  onMonthStep: (step: MonthStep) => void;
  /** Every group of the month, for the team pick (not the filtered ones). */
  groups: readonly ScheduleGroupVm[];
  filters: ScheduleFilters;
  /** Trailing controls, e.g. the day-off limit. */
  children?: ReactNode;
}

/** View switch, month navigation, search and the team pick (prototype P0911). */
export function ScheduleToolbar({ view, onViewChange, year, month, onMonthStep, groups, filters, children }: Props) {
  const viewItems = [
    { key: "team" as const, label: t("Timekeeping:Board:View:Team") },
    { key: "person" as const, label: t("Timekeeping:Board:View:Person") },
  ];

  return (
    <div className="ws-toolbar">
      <SegmentedTabs items={viewItems} activeKey={view} onChange={onViewChange} />
      <div className="ws-month-nav">
        <Button
          icon={<LeftOutlined />}
          aria-label={t("Timekeeping:Board:PrevMonth")}
          onClick={() => onMonthStep(-1)}
        />
        <span className="ws-month-label">{t("Timekeeping:Board:MonthLabel", month, year)}</span>
        <Button
          icon={<RightOutlined />}
          aria-label={t("Timekeeping:Board:NextMonth")}
          onClick={() => onMonthStep(1)}
        />
        <Button onClick={() => onMonthStep("today")}>{t("Timekeeping:Board:Today")}</Button>
      </div>
      <Input
        className="ws-search"
        allowClear
        prefix={<SearchOutlined />}
        placeholder={t("Timekeeping:Board:SearchPlaceholder")}
        aria-label={t("Timekeeping:Board:SearchAria")}
        value={filters.search}
        onChange={(e) => filters.setSearch(e.target.value)}
      />
      <TeamFilterDropdown groups={groups} filters={filters} />
      {children}
    </div>
  );
}
