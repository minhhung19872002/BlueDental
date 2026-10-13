import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { isNearScrollEnd } from "@/utils/scrollEnd";
import { filterOptions } from "./filterOptions";
import { useActiveOption } from "./useActiveOption";

export interface SearchSelectOption {
  value: string;
  label: string;
}

/**
 * Plain text, whatever the option stands for.
 *
 * Tag options used to render as coloured chips here — invented, not observed.
 * The reference's "Phân loại theo Tag" filter is the same widget as its
 * "Phân loại dịch vụ" one down to the markup: a search box over plain rows. The
 * coloured chip belongs to the record's own tag picker, not to a filter.
 */
function renderOptionLabel(option: SearchSelectOption): React.ReactNode {
  return option.label;
}

/** Keys that open the list from the focused field. */
const OPEN_KEYS = new Set(["Enter", " ", "ArrowDown", "ArrowUp"]);

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

export interface SearchSelectProps {
  value?: string;
  options: SearchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  status?: "error" | "";
  style?: React.CSSProperties;
  /** Dropdown empty state; defaults to "Không tìm thấy kết quả". */
  emptyText?: string;
  onChange?: (value: string | undefined) => void;
  onSearch?: (keyword: string) => void;
  /**
   * False when `onSearch` already narrows `options` on the server: matching
   * the label again here would drop hits on fields the label does not show
   * (phone) or that the server matches without diacritics.
   */
  filterLocally?: boolean;
  /** Reported the way AntD pickers report it, so floating-label wrappers work. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Rendered under the options, inside the dropdown. The reference puts an
   * "Khác" escape hatch there for lists that cannot cover every answer.
   */
  footer?: React.ReactNode;
  /**
   * For options paged in from the server: called as the list is scrolled to
   * its end. Leave it undefined once every page is in.
   */
  onLoadMore?: () => void;
  /** A spinner under the last row while the next page loads. */
  loadingMore?: boolean;
}

export const SearchSelect: React.FC<SearchSelectProps> = ({
  value,
  options,
  placeholder,
  disabled = false,
  allowClear = false,
  status,
  style,
  emptyText,
  onChange,
  onSearch,
  filterLocally = true,
  onOpenChange,
  footer,
  onLoadMore,
  loadingMore = false,
}) => {
  const resolvedPlaceholder = placeholder ?? t("Common:Search");
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(
    () => (filterLocally ? filterOptions(options, keyword) : options),
    [filterLocally, options, keyword]
  );

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  // The keyword is dropped on close, so a server-searched list must hear it too
  // — or it reopens narrowed to a search the box no longer shows.
  const closeDropdown = useCallback(() => {
    setOpen(false);
    setKeyword("");
    if (keyword) onSearch?.("");
    onOpenChange?.(false);
  }, [keyword, onSearch, onOpenChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const dropdown = document.getElementById("ss-portal-dropdown");
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdown &&
        !dropdown.contains(target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeDropdown]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => calcPos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, calcPos]);

  // Focus goes back to the field, so Tab carries on to the next one.
  const closeAndRefocus = useCallback(() => {
    closeDropdown();
    comboRef.current?.focus();
  }, [closeDropdown]);

  const handleSelect = useCallback(
    (opt: SearchSelectOption) => {
      onChange?.(opt.value);
      closeAndRefocus();
    },
    [onChange, closeAndRefocus]
  );

  const { activeIndex, setActiveIndex, listRef, handleListKeyDown } = useActiveOption({
    items: filtered,
    open,
    onPick: handleSelect,
  });

  const handleOpen = useCallback(() => {
    if (disabled) return;
    calcPos();
    setOpen(true);
    setKeyword("");
    // Start on the current value, so ↓ carries on from it.
    setActiveIndex(Math.max(options.findIndex((o) => o.value === value), 0));
    onOpenChange?.(true);
  }, [disabled, calcPos, setActiveIndex, options, value, onOpenChange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(undefined);
      setKeyword("");
    },
    [onChange]
  );

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    setActiveIndex(0);
    onSearch?.(e.target.value);
  };

  const handleOptionsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onLoadMore && isNearScrollEnd(e.currentTarget)) onLoadMore();
  };

  // Type a few letters, Enter takes the top hit; ↑/↓ walk the list first.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" || e.key === "Tab") {
      // The portal still bubbles through React: a Modal around the field must
      // neither close on this Escape nor wrap focus on this Tab.
      e.stopPropagation();
      closeAndRefocus();
      return;
    }
    handleListKeyDown(e);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (open || !OPEN_KEYS.has(e.key)) return;
    e.preventDefault();
    handleOpen();
  };

  const isError = status === "error";

  const dropdown =
    open && dropdownPos
      ? createPortal(
          <div
            id="ss-portal-dropdown"
            className="ss-dropdown"
            role="listbox"
            style={{
              position: "absolute",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            <div className="ss-search-row">
              <span className="ss-icon ss-icon--search ss-icon--sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
                </svg>
              </span>
              <input
                // Focused as it mounts, not after a timer: keys pressed right
                // after opening (↓ ↓ Enter) must not be lost.
                autoFocus
                className="ss-search-input"
                value={keyword}
                placeholder={t("Common:Search")}
                onChange={handleKeywordChange}
                onKeyDown={handleKeyDown}
                aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              />
            </div>
            <div ref={listRef} className="ss-options" onScroll={handleOptionsScroll}>
              {filtered.length === 0 ? (
                <div className="ss-empty">{emptyText ?? t("Common:NoResults")}</div>
              ) : (
                filtered.map((opt, index) => (
                  <div
                    key={opt.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={opt.value === value}
                    className={[
                      "ss-option",
                      opt.value === value && "ss-option--selected",
                      index === activeIndex && "ss-option--active",
                    ].filter(Boolean).join(" ")}
                    title={opt.label}
                    // Move, not enter: a row scrolled under a still mouse must not take the highlight.
                    onMouseMove={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                  >
                    {renderOptionLabel(opt)}
                  </div>
                ))
              )}
              {loadingMore && (
                <div className="ss-loading-more">
                  <Spin size="small" />
                </div>
              )}
            </div>
            {footer ? <div className="ss-footer">{footer}</div> : null}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={triggerRef}
        className={`ss-wrapper${open ? " ss-wrapper--open" : ""}${isError ? " ss-wrapper--error" : ""}${disabled ? " ss-wrapper--disabled" : ""}`}
        style={style}
      >
        <div
          className="ss-trigger"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          ref={comboRef}
          tabIndex={disabled ? -1 : 0}
          onClick={handleOpen}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="ss-icon ss-icon--search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
            </svg>
          </span>

          <span className="ss-value">
            {selectedOption ? (
              <span className="ss-value--selected">{renderOptionLabel(selectedOption)}</span>
            ) : (
              <span className="ss-value--placeholder">{resolvedPlaceholder}</span>
            )}
          </span>

          {allowClear && selectedOption && (
            <span
              className="ss-icon ss-icon--clear"
              onMouseDown={handleClear}
              title={t("Common:Clear")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </span>
          )}

          <span className={`ss-icon ss-icon--chevron${open ? " ss-icon--chevron-up" : ""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      {dropdown}
    </>
  );
};
