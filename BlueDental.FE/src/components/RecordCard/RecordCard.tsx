import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import "./record-card.css";

export interface RecordCardRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

interface Props {
  /** Head text: the row number or code. */
  title: ReactNode;
  /** Controls on the right of the head; style them with `.bd-rc-action`. */
  extra?: ReactNode;
  rows: RecordCardRow[];
  /** Rows folded behind "Xem thêm"; omitted or empty means no fold. */
  moreRows?: RecordCardRow[];
}

function Rows({ rows }: { rows: RecordCardRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className="bd-rc-row">
          <span className="bd-rc-label">{row.label}</span>
          <span className="bd-rc-value">{row.value}</span>
        </div>
      ))}
    </>
  );
}

/**
 * One table row rendered as a card for narrow screens, in the shell of the
 * prescription-line cards: primary head, label/value rows, a "Xem thêm" fold.
 */
export function RecordCard({ title, extra, rows, moreRows = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const foldable = moreRows.length > 0;

  return (
    <article className="bd-rc-card">
      <div className="bd-rc-head">
        <span className="bd-rc-title">{title}</span>
        {extra && <span className="bd-rc-extra">{extra}</span>}
      </div>
      <div className="bd-rc-body">
        <Rows rows={rows} />
        {foldable && expanded && <Rows rows={moreRows} />}
        {foldable && (
          <button
            type="button"
            className="bd-rc-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? t("Rút gọn") : t("Xem thêm")}
            <ChevronDown size={12} className={expanded ? "bd-rc-flip" : undefined} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}
