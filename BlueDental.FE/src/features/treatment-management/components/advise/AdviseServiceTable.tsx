import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { AdviseServiceRow } from "./AdviseServiceRow";
import { AdviseTableShell, type AdviseColumn } from "./AdviseTableShell";
import type { AdviseSelection } from "./useAdviseSelection";

interface Props {
  /** The pages loaded so far, already narrowed by the server to the group and search. */
  services: CatalogOption[];
  /** The first page is on its way. */
  loading: boolean;
  /** A further page is on its way. */
  loadingMore: boolean;
  hasMore: boolean;
  selection: AdviseSelection;
  onLoadMore: () => void;
}

const COLUMNS: readonly AdviseColumn[] = [
  { key: "service", label: "Treatment:Advise:Col:Service" },
  { key: "group", label: "Treatment:Advise:Col:Group" },
  { key: "price", label: "Treatment:Advise:Col:UnitPrice", align: "end" },
  { key: "quantity", label: "Treatment:Advise:Col:Quantity", align: "center" },
  { key: "discount", label: "Treatment:Advise:Col:Discount" },
  { key: "amount", label: "Treatment:Advise:Col:Amount", align: "end" },
];

/**
 * The Dịch vụ lẻ list of "Chọn dịch vụ": a tick on every row and a
 * select-all in the head. As on the reference the list is the server's,
 * twenty rows a page, the next page asked for at the bottom of the box.
 */
export function AdviseServiceTable({ services, loading, loadingMore, hasMore, selection, onLoadMore }: Props) {
  const tickedOnScreen = services.filter((service) => selection.isSelected(service.id)).length;
  const allTicked = services.length > 0 && tickedOnScreen === services.length;

  return (
    <AdviseTableShell
      variant="single"
      columns={COLUMNS}
      rowCount={services.length}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={hasMore}
      emptyText={t("Treatment:Service:NoMatchingService")}
      onLoadMore={onLoadMore}
      headCheck={
        <Checkbox
          checked={allTicked}
          indeterminate={tickedOnScreen > 0 && !allTicked}
          disabled={services.length === 0}
          aria-label={t("Treatment:Service:SelectAll")}
          onChange={(event) => selection.toggleAll(services, event.target.checked)}
        />
      }
    >
      {services.map((service) => (
        <AdviseServiceRow
          key={service.id}
          service={service}
          draft={selection.rows.get(service.id) ?? null}
          onToggle={selection.toggle}
          onChange={selection.update}
        />
      ))}
    </AdviseTableShell>
  );
}
