import { useEffect, useRef, type ReactNode } from "react";
import { Checkbox, Spin } from "antd";
import { t } from "@/lib/i18n";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { AdviseServiceRow } from "./AdviseServiceRow";
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
  /** "Lựa chọn dịch vụ" — the group strip and the search, above the table. */
  picker: ReactNode;
}

const COLUMNS = [
  { key: "service", label: "Treatment:Advise:Col:Service" },
  { key: "price", label: "Treatment:Advise:Col:UnitPrice" },
  { key: "quantity", label: "Treatment:Advise:Col:Quantity" },
  { key: "discount", label: "Treatment:Advise:Col:Discount" },
  { key: "amount", label: "Treatment:Advise:Col:Amount" },
  { key: "note", label: "Treatment:Advise:Col:Note" },
] as const;

/**
 * The service list of "Chọn Dịch Vụ": the "Lựa chọn dịch vụ" strip above,
 * then the table with a tick on every row and a select-all in the header.
 * As on the reference the list is the server's, twenty rows a page, and the
 * next page is asked for when the bottom of the 400px box comes into view.
 * Picking a group only filters — a service is chosen by its tick.
 */
export function AdviseServiceTable({
  services,
  loading,
  loadingMore,
  hasMore,
  selection,
  onLoadMore,
  picker,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tickedOnScreen = services.filter((service) => selection.isSelected(service.id)).length;
  const allTicked = services.length > 0 && tickedOnScreen === services.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) onLoadMore();
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, services.length]);

  return (
    <div className="am-services">
      {picker}

      <div className="am-table-card">
        <div className="am-table-scroll" ref={scrollRef}>
          <table className="am-table">
            <colgroup>
              <col className="am-col-check" />
              {COLUMNS.map((column) => (
                <col key={column.key} className={`am-col-${column.key}`} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="am-cell-check">
                  <Checkbox
                    checked={allTicked}
                    indeterminate={tickedOnScreen > 0 && !allTicked}
                    disabled={services.length === 0}
                    aria-label={t("Treatment:Service:SelectAll")}
                    onChange={(event) => selection.toggleAll(services, event.target.checked)}
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.key}>{t(column.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="am-empty">
                    <Spin size="small" />
                  </td>
                </tr>
              )}
              {!loading && services.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="am-empty">
                    {t("Treatment:Service:NoMatchingService")}
                  </td>
                </tr>
              )}
              {!loading &&
                services.map((service) => (
                  <AdviseServiceRow
                    key={service.id}
                    service={service}
                    draft={selection.rows.get(service.id) ?? null}
                    onToggle={selection.toggle}
                    onChange={selection.update}
                  />
                ))}
            </tbody>
          </table>
          {loadingMore && (
            <div className="am-more">
              <Spin size="small" />
            </div>
          )}
          <div ref={sentinelRef} className="am-sentinel" />
        </div>
      </div>
    </div>
  );
}
