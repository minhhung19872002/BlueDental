import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { SearchHints } from "@/components/global-search/SearchHints";
import { SearchResults } from "@/components/global-search/SearchResults";
import { useDebounce } from "@/hooks/useDebounce";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { t } from "@/lib/i18n";
import type { SearchRow } from "@/utils/globalSearchRows";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The Ctrl-K palette.
 *
 * Typing two characters searches Bệnh nhân, Lịch hẹn, CSKH and Nhân viên at
 * once (R-1053); ↑/↓ walk every listed row across the groups and Enter opens
 * the one reached. The reference's own result list could not be observed, so
 * the grouping is BlueDental's (docs/clone/unknowns.md).
 */
export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const debounced = useDebounce(query, 250);
  const { enabled, groups, isFetching } = useGlobalSearch(debounced);

  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const activeIndex = rows.findIndex((row) => row.key === activeKey);

  // Reopening should not show the last search.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // A new result list starts on its first row.
  useEffect(() => {
    setActiveKey(rows[0]?.key ?? null);
  }, [rows]);

  const openRow = (row: SearchRow) => {
    onClose();
    navigate(row.to);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (Math.max(activeIndex, 0) + step + rows.length) % rows.length;
      setActiveKey(rows[next].key);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openRow(rows[Math.max(activeIndex, 0)]);
    }
  };

  if (!open) return null;

  return (
    <div className="app-search-overlay" onClick={onClose}>
      <div className="app-search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="app-search-input-row">
          {/* The design puts the icon, a borderless field and the Esc key on
              one line, rather than a bordered input inside a padded box. */}
          <SearchOutlined className="app-search-icon" />
          <Input
            autoFocus
            variant="borderless"
            placeholder={t("Common:SearchGlobalPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            className="app-search-field"
          />
          <kbd className="app-search-esc" onClick={onClose}>
            Esc
          </kbd>
        </div>

        {enabled ? (
          <SearchResults
            term={debounced.trim()}
            groups={groups}
            loading={isFetching}
            activeKey={activeKey}
            onOpen={openRow}
            onHover={(row) => setActiveKey(row.key)}
          />
        ) : (
          <SearchHints />
        )}
      </div>
    </div>
  );
}
