import { useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { WARRANTY_ROW_GROUP, type WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { WarrantyFilterChips } from "./WarrantyFilterChips";
import { countRows, filterRows, ROW_FILTERS, type RowFilter } from "./planWarrantyView";
import { warrantyStatusColumns, type StatusActions } from "./warrantyStatusColumns";

interface Props {
  rows: WarrantyServiceRowDto[];
  filter: RowFilter;
  onFilterChange: (filter: RowFilter) => void;
  /** `line=` of the link that opened the tab: that row is marked. */
  highlightLineId: string | null;
  actions: StatusActions;
}

/**
 * TÌNH TRẠNG BẢO HÀNH THEO DỊCH VỤ (m366, REQ-B2…B4): every live line of the
 * slip with its dental and Labo warranty, the ones waiting on a card on cream.
 */
export function WarrantyStatusCard({ rows, filter, onFilterChange, highlightLineId, actions }: Props) {
  const columns = useMemo(() => warrantyStatusColumns(actions), [actions]);
  const chips = ROW_FILTERS.map((chip) => ({ ...chip, count: countRows(rows, chip.key) }));

  const rowClassName = (row: WarrantyServiceRowDto) =>
    [
      row.group === WARRANTY_ROW_GROUP.Ready && "pwt-row--ready",
      row.lineId === highlightLineId && "pwt-row--focus",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <section className="pwt-card" aria-labelledby="pwt-status-title">
      <header className="pwt-card-head">
        <h2 id="pwt-status-title" className="pwt-card-title">
          {t("Treatment:Warranty:StatusTitle")}
        </h2>
        <WarrantyFilterChips
          chips={chips}
          value={filter}
          label={t("Treatment:Warranty:StatusTitle")}
          onChange={onFilterChange}
        />
      </header>
      <div className="bd-cat-card tp-table pdt-table pwt-table">
        <DataTable<WarrantyServiceRowDto>
          rowKey="lineId"
          columns={columns}
          dataSource={filterRows(rows, filter)}
          rowClassName={rowClassName}
          pagination={false}
          locale={{ emptyText: t("Treatment:Common:NoData") }}
        />
      </div>
    </section>
  );
}
