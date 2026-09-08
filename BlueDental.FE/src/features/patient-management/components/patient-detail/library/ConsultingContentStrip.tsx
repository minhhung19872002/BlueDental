import type { UIEvent } from "react";
import { Input, Spin } from "antd";
import { ChevronDown, FileText, Search } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ConsultingLibrary } from "./useConsultingLibrary";

interface Props {
  library: ConsultingLibrary;
  /** Full-screen only: folds the tray down to its button. */
  onCollapse?: () => void;
}

/** The reference cycles ten chip tints by position. */
const CHIP_TONES = 10;
/** Past ten contents the reference adds a search box over the chips. */
const SEARCH_FROM = 10;

/**
 * "Nội dung tư vấn" — the strip of chips under the sheet, one per content of
 * the open topic: a lettered square, the name on two lines and its number in
 * the corner. Scrolling to the end fetches the next twenty.
 */
export function ConsultingContentStrip({ library, onCollapse }: Props) {
  const { contents, contentsTotal, contentsLoading, content, selectContent } = library;
  const { contentSearch, setContentSearch, hasMore, loadMore } = library;
  const searchable = contentSearch !== "" || contents.length > SEARCH_FROM || hasMore;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const strip = event.currentTarget;
    const nearEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 80;
    if (nearEnd && hasMore && !contentsLoading) loadMore();
  };

  return (
    <section className="pd-lib-strip" aria-label={t("Nội dung tư vấn")}>
      <div className="pd-lib-strip__head">
        <div className="pd-lib-strip__title">
          <FileText size={16} />
          <span>{t("Nội dung tư vấn")}</span>
          <span className="pd-lib-count">{contentsTotal}</span>
        </div>
        {searchable && (
          <Input
            className="pd-lib-search pd-lib-search--strip"
            aria-label={t("Tìm nội dung tư vấn")}
            placeholder={t("Tìm nội dung tư vấn...")}
            prefix={<Search size={14} />}
            value={contentSearch}
            onChange={(event) => setContentSearch(event.target.value)}
            allowClear
          />
        )}
        {onCollapse && (
          <button
            type="button"
            className="pd-lib-icon-btn"
            aria-label={t("Đóng danh sách nội dung tư vấn")}
            title={t("Đóng danh sách nội dung tư vấn")}
            onClick={onCollapse}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      <div className="pd-lib-strip__chips" onScroll={handleScroll}>
        {contentsLoading && contents.length === 0 && (
          <div className="pd-lib-strip__loading">
            <Spin size="small" />
          </div>
        )}
        {contents.map((item, index) => {
          const active = item.id === content?.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "true" : undefined}
              className={["pd-lib-chip", active && "pd-lib-chip--active"].filter(Boolean).join(" ")}
              data-tone={index % CHIP_TONES}
              onClick={() => selectContent(item)}
            >
              <span className="pd-lib-chip__avatar">
                {item.name.trim().charAt(0).toLocaleUpperCase("vi") || "?"}
              </span>
              <span className="pd-lib-chip__name">{item.name}</span>
              <span className="pd-lib-chip__index">{index + 1}</span>
            </button>
          );
        })}
        {hasMore && contents.length > 0 && (
          <div className="pd-lib-strip__more">
            <Spin size="small" />
          </div>
        )}
      </div>
    </section>
  );
}
