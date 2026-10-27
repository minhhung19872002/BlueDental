import type { KeyboardEvent } from "react";
import { SelectLoading } from "@/components/SelectLoading";
import { t } from "@/lib/i18n";
import type { SearchGroup, SearchRow } from "@/utils/globalSearchRows";

interface Props {
  term: string;
  groups: SearchGroup[];
  loading: boolean;
  activeKey: string | null;
  onOpen: (row: SearchRow) => void;
  onHover: (row: SearchRow) => void;
}

/**
 * The palette's hits, one block per group with its count (R-1053). A group
 * with nothing to show is left out; all four empty is the "Không tìm thấy" line.
 */
export function SearchResults({ term, groups, loading, activeKey, onOpen, onHover }: Props) {
  if (groups.length === 0) {
    return (
      <div className="app-search-results">
        {loading ? (
          // Hits-high rows rather than a spinner the results then push open.
          <SelectLoading rows={3} rowHeight={61} />
        ) : (
          <div className="app-search-hint">{t("Common:NoResultsFor", term)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="app-search-results" role="listbox">
      {groups.map((group) => (
        <section key={group.key} className="app-search-group" aria-label={group.title}>
          <div className="app-search-group-title">
            {group.title}
            <span className="app-search-group-count">{group.total}</span>
          </div>
          {group.rows.map((row) => (
            <SearchHit
              key={row.key}
              row={row}
              active={row.key === activeKey}
              onOpen={onOpen}
              onHover={onHover}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

interface HitProps {
  row: SearchRow;
  active: boolean;
  onOpen: (row: SearchRow) => void;
  onHover: (row: SearchRow) => void;
}

function SearchHit({ row, active, onOpen, onHover }: HitProps) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(row);
    }
  };

  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      // Keeps the row the arrow keys reached in view as the list scrolls.
      ref={active ? (node) => node?.scrollIntoView?.({ block: "nearest" }) : undefined}
      className={["app-search-hit", active && "app-search-hit--active"].filter(Boolean).join(" ")}
      onClick={() => onOpen(row)}
      onMouseMove={() => onHover(row)}
      onKeyDown={handleKeyDown}
    >
      <span className="app-search-hit-badge">{row.badge}</span>
      <span className="app-search-hit-text">
        <span className="app-search-hit-name">{row.name}</span>
        <span className="app-search-hit-meta">{row.meta}</span>
      </span>
      <span className="app-search-hit-arrow">→</span>
    </div>
  );
}
