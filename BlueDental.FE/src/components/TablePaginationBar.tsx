import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { t, tRich } from "@/lib/i18n";

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

/** Slots either hold a page number or the gap marker between two ranges. */
type Slot = number | "gap";

/**
 * Page slots around the current page: always the first and last page, the
 * current page with one neighbour on each side, and a gap where pages were
 * skipped. Under eight pages nothing is skipped at all.
 */
export function pageSlots(current: number, totalPages: number): Slot[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const window = new Set([1, totalPages, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => window.add(page));
  if (current >= totalPages - 2)
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => window.add(page));

  const pages = [...window].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  return pages.flatMap<Slot>((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? ["gap", page] : [page],
  );
}

const STEP_BUTTON = "bd-pager-step";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /** Noun counted in the summary line, e.g. "bản ghi". */
  unitLabel?: string;
  className?: string;
}

/**
 * Footer bar of a data table: page size on the left with a plain-language
 * summary, page stepper on the right.
 */
export function TablePaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  unitLabel,
  className,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const unit = unitLabel ?? t("bản ghi");

  const strong = (value: number) => (
    <span className="bd-pager-strong">{value.toLocaleString("vi-VN")}</span>
  );

  return (
    <div
      className={cn("bd-pager", className)}
    >
      <div className="bd-pager-left">
        <label htmlFor="table-page-size" className="bd-sr-only">
          {t("Số dòng mỗi trang")}
        </label>
        <select
          id="table-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="bd-pager-size"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {t("{0} / trang", size)}
            </option>
          ))}
        </select>

        {/* An empty list has no range to name, so it counts rather than spans. */}
        <p className="bd-pager-summary" aria-live="polite">
          {/* Some lists count nothing in particular, so the noun is left out. */}
          {unit
            ? total === 0
              ? tRich("Hiển thị {0} trên {1} {2}", strong(0), strong(0), unit)
              : tRich(
                  "Hiển thị {0}–{1} trên {2} {3}",
                  strong(from),
                  strong(to),
                  strong(total),
                  unit,
                )
            : total === 0
              ? tRich("Hiển thị {0} trên {1}", strong(0), strong(0))
              : tRich("Hiển thị {0}–{1} trên {2}", strong(from), strong(to), strong(total))}
        </p>
      </div>

      <div className="bd-pager-steps">
        <button
          type="button"
          className={STEP_BUTTON}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="bd-icon bd-icon--sm" aria-hidden="true" />
          {t("Trước")}
        </button>

        {(total === 0 ? [] : pageSlots(current, totalPages)).map((slot, index) =>
          slot === "gap" ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="bd-pager-gap"
            >
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              aria-label={t("Trang {0}", slot)}
              aria-current={slot === current ? "page" : undefined}
              onClick={() => onPageChange(slot)}
              className={cn("bd-pager-page", slot === current && "bd-pager-page--on")}
            >
              {slot}
            </button>
          ),
        )}

        <button
          type="button"
          className={STEP_BUTTON}
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
        >
          {t("Sau")}
          <ChevronRight className="bd-icon bd-icon--sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
