import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import type { CareType } from "../../api/careApi";
import { channelLabels, MESSAGE_CHANNELS, type MessageChannel, type MessageTemplateList } from "../../api/templateApi";
import { CARE_TABS } from "../../careTabs";
import { CountPill } from "./CountPill";

type ChannelKey = "all" | `${MessageChannel}`;

const ALL_PURPOSES = "all";

interface TemplateFilterBarProps {
  counts: MessageTemplateList | undefined;
  channel: MessageChannel | null;
  search: string;
  purpose: CareType | null;
  onChannelChange: (channel: MessageChannel | null) => void;
  onSearchChange: (search: string) => void;
  onPurposeChange: (purpose: CareType | null) => void;
}

function countOf(counts: MessageTemplateList | undefined, channel: MessageChannel | null): number {
  if (!counts) return 0;
  if (channel === null) return counts.allCount;
  return [counts.smsCount, counts.zaloCount, counts.emailCount][channel];
}

/** Kênh pills with their counts · search on name and text · Mục đích. */
export function TemplateFilterBar({
  counts,
  channel,
  search,
  purpose,
  onChannelChange,
  onSearchChange,
  onPurposeChange,
}: TemplateFilterBarProps) {
  const labels = channelLabels();
  const items = [
    { key: "all" as ChannelKey, label: <CountPill label={t("CSKH:Template:AllChannels")} count={countOf(counts, null)} /> },
    ...MESSAGE_CHANNELS.map((item) => ({
      key: `${item}` as ChannelKey,
      label: <CountPill label={labels[item]} count={countOf(counts, item)} />,
    })),
  ];

  const handleChannel = (key: ChannelKey) => {
    onChannelChange(MESSAGE_CHANNELS.find((item) => `${item}` === key) ?? null);
  };

  const handlePurpose = (value: CareType | typeof ALL_PURPOSES) => {
    onPurposeChange(value === ALL_PURPOSES ? null : value);
  };

  return (
    <div className="tpl-filter-bar">
      <SegmentedTabs items={items} activeKey={channel === null ? "all" : `${channel}`} onChange={handleChannel} />
      <Input
        allowClear
        className="tpl-filter-search"
        aria-label={t("CSKH:Template:Search")}
        placeholder={t("CSKH:Template:Search")}
        prefix={<SearchOutlined />}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select<CareType | typeof ALL_PURPOSES>
        className="tpl-filter-purpose"
        aria-label={t("CSKH:Template:Purpose")}
        prefix={<span className="tpl-filter-prefix">{t("CSKH:Template:Purpose")}</span>}
        value={purpose ?? ALL_PURPOSES}
        onChange={handlePurpose}
        options={[
          { value: ALL_PURPOSES, label: t("CSKH:Template:AllPurposes") },
          ...CARE_TABS.map((tab) => ({ value: tab.type, label: tab.label() })),
        ]}
      />
    </div>
  );
}
