import { useMemo, useState } from "react";
import { monthToDate, previousPeriod, type PeriodRangeValue } from "@/components/PeriodRangePicker";
import type { StatsFilter, StatsOverviewInput, StatsTemplateOption } from "../api/statsApi";
import type { MessageChannel } from "../api/templateApi";

export interface StatsFilters {
  period: PeriodRangeValue;
  channel: MessageChannel | null;
  templateId: string | null;
  /** What every table and the Excel read. */
  filter: StatsFilter;
  /** The filter plus the comparison period when "So sánh kỳ trước" is ticked. */
  overviewInput: StatsOverviewInput;
  setPeriod: (period: PeriodRangeValue) => void;
  setChannel: (channel: MessageChannel | null, templates: readonly StatsTemplateOption[]) => void;
  setTemplateId: (templateId: string | null) => void;
}

/** The filter row of Thống kê CSKH: Thời gian (this month by default, BA), Kênh, Mẫu. */
export function useStatsFilters(): StatsFilters {
  const [period, setPeriod] = useState<PeriodRangeValue>(() => monthToDate());
  const [channel, setChannelState] = useState<MessageChannel | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const filter = useMemo<StatsFilter>(
    () => ({ fromDate: period.from, toDate: period.to, channel, templateId }),
    [period.from, period.to, channel, templateId],
  );

  const overviewInput = useMemo<StatsOverviewInput>(() => {
    const previous = period.compare ? previousPeriod(period) : null;
    return { ...filter, compareFromDate: previous?.from ?? null, compareToDate: previous?.to ?? null };
  }, [filter, period]);

  // A template of another channel would leave every table empty: let it go.
  const setChannel = (next: MessageChannel | null, templates: readonly StatsTemplateOption[]) => {
    setChannelState(next);
    const picked = templates.find((template) => template.id === templateId);
    if (next !== null && picked && picked.channel !== next) setTemplateId(null);
  };

  return { period, channel, templateId, filter, overviewInput, setPeriod, setChannel, setTemplateId };
}
