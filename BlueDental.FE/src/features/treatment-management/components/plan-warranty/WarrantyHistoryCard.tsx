import type { Ref } from "react";
import { Tag } from "antd";
import { t } from "@/lib/i18n";
import type { PlanWarrantyOverviewDto } from "../../api/planWarrantyApi";
import { WarrantyFilterChips } from "./WarrantyFilterChips";
import { WarrantyRequestPanel } from "./WarrantyRequestPanel";
import { WarrantyTimeline } from "./WarrantyTimeline";
import { HISTORY_FILTERS, historyDays, type HistoryFilter } from "./planWarrantyView";

export interface HistoryView {
  filter: HistoryFilter;
  /** The card "Lịch sử ↓" picked; its events only. */
  cardCode: string | null;
}

interface Props {
  ref?: Ref<HTMLElement>;
  overview: Pick<PlanWarrantyOverviewDto, "history" | "cards" | "today" | "openRequests" | "doneRequests">;
  view: HistoryView;
  onViewChange: (view: HistoryView) => void;
}

/** LỊCH SỬ BẢO HÀNH (m371, REQ-B7): Labo, dental cards and warranty stages on one timeline. */
export function WarrantyHistoryCard({ ref, overview, view, onViewChange }: Props) {
  const requests = overview.openRequests + overview.doneRequests;
  const chips = HISTORY_FILTERS.map((chip) => (chip.key === "request" ? { ...chip, count: requests } : chip));
  const days = historyDays(overview.history, view.filter, view.cardCode);

  return (
    <section ref={ref} className="pwt-card" aria-labelledby="pwt-history-title">
      <header className="pwt-card-head">
        <h2 id="pwt-history-title" className="pwt-card-title">
          {t("Treatment:Warranty:HistoryTitle")}
        </h2>
        {view.cardCode && (
          <Tag closable className="pwt-filter-tag" onClose={() => onViewChange({ ...view, cardCode: null })}>
            {view.cardCode}
          </Tag>
        )}
        <WarrantyFilterChips<HistoryFilter>
          chips={chips}
          value={view.filter}
          label={t("Treatment:Warranty:HistoryTitle")}
          onChange={(filter) => onViewChange({ ...view, filter })}
        />
      </header>
      <div className="pwt-history">
        <WarrantyTimeline days={days} today={overview.today} cards={overview.cards} />
        <WarrantyRequestPanel open={overview.openRequests} done={overview.doneRequests} />
      </div>
    </section>
  );
}
