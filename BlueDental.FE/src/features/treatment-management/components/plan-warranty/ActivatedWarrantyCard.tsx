import { useMemo, type Ref } from "react";
import { Select, Tag } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import type { WarrantyCardRowDto } from "../../api/planWarrantyApi";
import { activatedCardColumns } from "./activatedCardColumns";
import { WarrantyFilterChips } from "./WarrantyFilterChips";
import {
  CARD_FILTERS,
  CARD_SORTS,
  countCards,
  visibleCards,
  type CardKindFilter,
  type CardSort,
  type CardView,
} from "./planWarrantyView";

interface Props {
  ref?: Ref<HTMLElement>;
  cards: WarrantyCardRowDto[];
  today: string;
  view: CardView;
  /** "Bọc sứ Emax - R24" while "Xem thẻ ›" narrows the list to one line. */
  lineLabel: string | null;
  onViewChange: (view: CardView) => void;
  onHistory: (code: string) => void;
  onView: (card: WarrantyCardRowDto) => void;
}

/**
 * PHIẾU BẢO HÀNH ĐÃ KÍCH HOẠT (m360, REQ-B6): the slip's dental and Labo
 * cards, soonest to run out first. No Lượt column (D5).
 */
export function ActivatedWarrantyCard({ ref, cards, today, view, lineLabel, onViewChange, onHistory, onView }: Props) {
  const columns = useMemo(() => activatedCardColumns(today, { onView, onHistory }), [today, onView, onHistory]);
  const chips = CARD_FILTERS.map((chip) => ({ ...chip, count: countCards(cards, chip.key) }));
  const sortOptions = CARD_SORTS.map((option) => ({ value: option.key, label: t(option.label) }));

  return (
    <section ref={ref} className="pwt-card" aria-labelledby="pwt-cards-title">
      <header className="pwt-card-head">
        <h2 id="pwt-cards-title" className="pwt-card-title">
          {t("Treatment:Warranty:CardsTitle")}
        </h2>
        {lineLabel && (
          <Tag closable className="pwt-filter-tag" onClose={() => onViewChange({ ...view, lineId: null })}>
            {lineLabel}
          </Tag>
        )}
        <WarrantyFilterChips<CardKindFilter>
          chips={chips}
          value={view.kind}
          label={t("Treatment:Warranty:CardsTitle")}
          onChange={(kind) => onViewChange({ ...view, kind })}
        />
        <Select<CardSort>
          className="pwt-sort"
          prefix={t("Treatment:Warranty:SortBy")}
          value={view.sort}
          options={sortOptions}
          popupMatchSelectWidth={false}
          aria-label={t("Treatment:Warranty:SortBy")}
          onChange={(sort) => onViewChange({ ...view, sort })}
        />
      </header>
      <div className="bd-cat-card tp-table pdt-table pwt-table">
        <DataTable<WarrantyCardRowDto>
          rowKey="code"
          columns={columns}
          dataSource={visibleCards(cards, view)}
          pagination={false}
          locale={{ emptyText: t("Treatment:Warranty:NoCards") }}
        />
      </div>
    </section>
  );
}
