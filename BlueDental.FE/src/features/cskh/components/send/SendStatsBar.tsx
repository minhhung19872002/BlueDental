import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RecipientStats } from "../../sendRecipients";

interface SendStatsBarProps {
  stats: RecipientStats;
  contactName: string;
  query: string;
  onQueryChange: (query: string) => void;
}

/** The chips split the rows in play, so they add up to "{total} khách". */
export function SendStatsBar({ stats, contactName, query, onQueryChange }: SendStatsBarProps) {
  const chips = [
    { tone: "total", count: stats.total, label: t("CSKH:Send:Stat:Total") },
    { tone: "fresh", count: stats.fresh, label: t("CSKH:Send:Stat:Fresh") },
    { tone: "received", count: stats.received, label: t("CSKH:Send:Stat:Received") },
    { tone: "none", count: stats.noContact, label: t("CSKH:Send:Stat:NoContact", contactName) },
    { tone: "missing", count: stats.missing, label: t("CSKH:Send:Stat:Missing") },
  ];
  return (
    <div className="snd-stats">
      {chips.map((chip) => (
        <span key={chip.tone} className={`snd-stat snd-stat--${chip.tone}`}>
          <strong>{chip.count}</strong> {chip.label}
        </span>
      ))}
      <span className="snd-stats-spacer" />
      <label className="snd-stats-search">
        <SearchOutlined aria-hidden="true" />
        <input
          type="search"
          value={query}
          aria-label={t("CSKH:Send:SearchRowAria")}
          placeholder={t("CSKH:Send:SearchRow")}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
    </div>
  );
}
