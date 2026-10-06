import type { ReactNode } from "react";
import { Spin } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useChipScroller } from "@/hooks/useChipScroller";
import type { TaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { splitChipRows } from "./splitChipRows";

interface Props {
  groups: TaxonomyGroupOption[];
  activeGroupId: string | null;
  /** "Lựa chọn dịch vụ", its Dịch vụ lẻ / Combo switch and the search. */
  head: ReactNode;
  /** The combo suggestion, between the head and the strip. */
  notice?: ReactNode;
  /** The first page of groups is still on its way. */
  loading: boolean;
  /** A later page is on its way — a spinner pill closes the last row. */
  loadingMore: boolean;
  onGroupChange: (groupId: string | null) => void;
  /** The strip scrolled near its end: time for the next page of groups. */
  onNearEnd: () => void;
}

/**
 * "Lựa chọn dịch vụ" of "Chọn Dịch Vụ", laid out as the reference's shared
 * chip select (staging bundle, 2026-09-24): the label with a 260px "Tìm dịch
 * vụ" box beside it, then the service groups as pills in a sideways strip
 * between two round arrows, split over two rows. There is no "all" pill —
 * nothing picked means every group, and clicking the picked pill lets go.
 */
export function AdviseGroupPicker({
  groups,
  activeGroupId,
  head,
  notice,
  loading,
  loadingMore,
  onGroupChange,
  onNearEnd,
}: Props) {
  const scroller = useChipScroller(groups.length, onNearEnd);
  const label = t("Treatment:Advise:ServiceSelection");
  const rows = splitChipRows(groups, (group) => group.name);
  const empty = !loading && groups.length === 0;

  return (
    <div className="am-picker">
      {head}
      {notice}

      <div className="am-picker-strip">
        {loading && (
          <div className="am-picker-loading">
            <Spin size="small" />
          </div>
        )}
        {empty ? (
          <span className="am-picker-empty">{t("Common:NoData")}</span>
        ) : (
          <div className="am-picker-carousel">
            <button
              type="button"
              className="am-picker-arrow"
              aria-label={t("Treatment:Advise:SlideLeft", label)}
              disabled={!scroller.canPrev}
              onClick={scroller.prev}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="am-picker-chips" ref={scroller.ref} onScroll={scroller.onScroll}>
              {rows.map((row, index) => (
                <div key={index} className="am-picker-row">
                  {row.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      title={group.name}
                      className={activeGroupId === group.id ? "active" : undefined}
                      aria-pressed={activeGroupId === group.id}
                      onClick={() => onGroupChange(activeGroupId === group.id ? null : group.id)}
                    >
                      {group.name}
                    </button>
                  ))}
                  {loadingMore && index === rows.length - 1 && (
                    <span className="am-picker-more">
                      <Spin size="small" />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="am-picker-arrow"
              aria-label={t("Treatment:Advise:SlideRight", label)}
              disabled={!scroller.canNext}
              onClick={scroller.next}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
