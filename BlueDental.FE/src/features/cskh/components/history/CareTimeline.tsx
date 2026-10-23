import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { HISTORY_FILTER, type HistoryEntry, type HistoryFilter } from "../../api/careHistoryApi";
import { CareHistoryLine } from "./CareHistoryLine";

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: HISTORY_FILTER.All, label: "CSKH:History:Filter:All" },
  { value: HISTORY_FILTER.ZaloChat, label: "CSKH:History:Filter:ZaloChat" },
  { value: HISTORY_FILTER.Message, label: "CSKH:History:Filter:Message" },
  { value: HISTORY_FILTER.Call, label: "CSKH:History:Filter:Call" },
  { value: HISTORY_FILTER.Note, label: "CSKH:History:Filter:Note" },
];

interface Props {
  entries: HistoryEntry[] | undefined;
  loading: boolean;
  filter: HistoryFilter;
  canEditNotes: boolean;
  onFilterChange: (filter: HistoryFilter) => void;
}

/** Tất cả · Chat Zalo · ZNS / SMS · Gọi điện · Ghi chú, then every line newest first (BA P2210). */
export function CareTimeline({ entries, loading, filter, canEditNotes, onFilterChange }: Props) {
  return (
    <section className="ch-card" aria-label={t("CSKH:History:Timeline")}>
      <div className="ch-filters" role="tablist" aria-label={t("CSKH:History:Timeline")}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={["ch-filter", filter === item.value && "ch-filter--active"].filter(Boolean).join(" ")}
            onClick={() => onFilterChange(item.value)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <Spin spinning={loading}>
        {entries?.length === 0 ? (
          <p className="ch-empty">{t("CSKH:History:Empty")}</p>
        ) : (
          <ul className="ch-lines">
            {(entries ?? []).map((entry) => (
              <CareHistoryLine key={entry.key} entry={entry} canEditNotes={canEditNotes} />
            ))}
          </ul>
        )}
      </Spin>
    </section>
  );
}
