import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { STATS_LIMITS, STATS_OUTCOME, type StatsFilter, type StatsOutcome } from "../../api/statsApi";
import type { StatsRecipientSearch } from "../../hooks/useStatsRecipientQuery";
import { StatsRecipientsTable } from "./StatsRecipientsTable";

interface Props {
  filter: StatsFilter;
  search: StatsRecipientSearch;
}

const ANY = 0;

function outcomeOptions() {
  return [
    { value: ANY, label: t("CSKH:Stats:AnyOutcome") },
    { value: STATS_OUTCOME.Succeeded, label: t("CSKH:Stats:Outcome:Succeeded") },
    { value: STATS_OUTCOME.Failed, label: t("CSKH:Stats:Outcome:Failed") },
    { value: STATS_OUTCOME.Pending, label: t("CSKH:Stats:Outcome:Pending") },
  ];
}

function toOutcome(value: number): StatsOutcome | null {
  return Object.values(STATS_OUTCOME).find((outcome) => outcome === value) ?? null;
}

/**
 * Người nhận (BA img_32). The search box lives outside the keyed table, so
 * typing never remounts it and the caret stays put.
 */
export function StatsRecipientsCard({ filter, search }: Props) {
  return (
    <section className="page-card cskh-stats-card cskh-stats-table-card">
      <div className="dash-card-head cskh-stats-recipients-head">
        <h2 className="dash-card-title">{t("CSKH:Stats:Recipients")}</h2>
        <div className="cskh-stats-recipients-tools">
          <Input
            allowClear
            className="cskh-stats-search"
            prefix={<SearchOutlined />}
            placeholder={t("CSKH:Stats:SearchRecipient")}
            aria-label={t("CSKH:Stats:SearchRecipient")}
            maxLength={STATS_LIMITS.maxFilter}
            value={search.text}
            onChange={(event) => search.setText(event.target.value)}
          />
          <Select<number>
            className="cskh-stats-outcome-select"
            aria-label={t("CSKH:Stats:Col:Status")}
            value={search.outcome ?? ANY}
            options={outcomeOptions()}
            popupMatchSelectWidth={false}
            onChange={(value) => search.setOutcome(toOutcome(value))}
          />
        </div>
      </div>
      <StatsRecipientsTable
        key={JSON.stringify([filter, search.query])}
        filter={filter}
        query={search.query}
        onSortChange={search.setSorting}
      />
    </section>
  );
}
