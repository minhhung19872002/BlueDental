import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";

/** Bars of a different length on each row, so the placeholder reads as a list. */
const BARS = [62, 48, 70, 40, 56, 66, 52, 44];

interface Props {
  /** How many rows to hold room for — about as many as the list usually shows. */
  rows?: number;
  /** The height of one real row: 40px is the theme's option height. */
  rowHeight?: number;
  /** A second, short bar at the end of each row, for lists that show a price or a count. */
  trailing?: boolean;
}

/**
 * What a dropdown shows while its first options are on their way: rows the
 * height of real ones in place of a lone spinner or "Đang tải", so the popup
 * opens at about its full size instead of jumping from one line to the list
 * when the options land.
 *
 * Works as a Select's `notFoundContent` (it cancels the empty slot's padding)
 * and as the body of a hand-drawn popup.
 */
export function SelectLoading({ rows = 5, rowHeight = 40, trailing = false }: Props) {
  return (
    <div
      className="bd-select-loading"
      role="status"
      aria-label={t("Common:Loading")}
      style={{ "--row-h": `${rowHeight}px` } as CSSProperties}
    >
      {Array.from({ length: rows }, (_, at) => (
        <div key={at} className="bd-select-loading-row">
          <span style={{ "--bar": `${BARS[at % BARS.length]}%` } as CSSProperties} />
          {trailing && <span className="bd-select-loading-tail" />}
        </div>
      ))}
    </div>
  );
}
