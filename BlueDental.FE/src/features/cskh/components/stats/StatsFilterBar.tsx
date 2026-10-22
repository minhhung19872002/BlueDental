import { Select } from "antd";
import { t } from "@/lib/i18n";
import { PeriodRangePicker } from "@/components/PeriodRangePicker";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/SegmentedTabs";
import { foldForSearch } from "@/utils/foldForSearch";
import { STATS_LIMITS, type StatsTemplateOption } from "../../api/statsApi";
import { MESSAGE_CHANNELS, channelLabels, type MessageChannel } from "../../api/templateApi";
import type { StatsFilters } from "../../hooks/useStatsFilters";

interface Props {
  filters: StatsFilters;
  templates: readonly StatsTemplateOption[];
  templatesLoading: boolean;
}

const ALL = "all";
type ChannelKey = typeof ALL | `${MessageChannel}`;

function channelItems(): SegmentedTabItem<ChannelKey>[] {
  const labels = channelLabels();
  return [
    { key: ALL, label: t("CSKH:Stats:AllChannels") },
    ...MESSAGE_CHANNELS.map((channel) => ({ key: `${channel}` as const, label: labels[channel] })),
  ];
}

interface TemplateChoice {
  value: string;
  label: string;
  search: string;
}

function filterTemplate(input: string, option?: TemplateChoice): boolean {
  return option?.search.includes(foldForSearch(input)) ?? false;
}

function toChannel(key: ChannelKey): MessageChannel | null {
  return MESSAGE_CHANNELS.find((channel) => `${channel}` === key) ?? null;
}

/** Thời gian · Kênh · Mẫu, one row above everything they filter (BA img_31). */
export function StatsFilterBar({ filters, templates, templatesLoading }: Props) {
  const shown = filters.channel === null ? templates : templates.filter((item) => item.channel === filters.channel);
  const options: TemplateChoice[] = [
    { value: "", label: t("CSKH:Stats:AllTemplates"), search: foldForSearch(t("CSKH:Stats:AllTemplates")) },
    ...shown.map((item) => ({ value: item.id, label: item.name, search: foldForSearch(item.name) })),
  ];

  return (
    <div className="page-card cskh-stats-filters">
      <label className="cskh-stats-filter">
        <span className="cskh-stats-filter-label">{t("CSKH:Stats:Period")}</span>
        <PeriodRangePicker value={filters.period} onChange={filters.setPeriod} maxDays={STATS_LIMITS.maxDays} />
      </label>
      <SegmentedTabs
        items={channelItems()}
        activeKey={filters.channel === null ? ALL : `${filters.channel}`}
        onChange={(key) => filters.setChannel(toChannel(key), templates)}
        className="cskh-stats-channels"
      />
      <label className="cskh-stats-filter">
        <span className="cskh-stats-filter-label">{t("CSKH:Stats:TemplateFilter")}</span>
        <Select<string, TemplateChoice>
          className="cskh-stats-template"
          aria-label={t("CSKH:Stats:TemplateFilter")}
          value={filters.templateId ?? ""}
          options={options}
          loading={templatesLoading}
          showSearch={{ filterOption: filterTemplate }}
          popupMatchSelectWidth={false}
          onChange={(value) => filters.setTemplateId(value || null)}
        />
      </label>
    </div>
  );
}
