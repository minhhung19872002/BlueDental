import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { PriorityList } from "./PriorityList";
import { usePortalDropdown } from "./usePortalDropdown";
import type { SearchSelectOption } from "./SearchSelect";

export interface RankedMultiSearchSelectProps {
  /** The picked values; they are kept in the options' order. */
  value: string[];
  /** Highest priority first — the order the picks are ranked in. */
  options: SearchSelectOption[];
  placeholder?: string;
  /** Says where the ranking comes from, beside the list's heading. */
  rankHint?: string;
  onChange: (value: string[]) => void;
}

const SearchIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
  </svg>
);

/**
 * SearchSelect's look, picking several: rows tick on and off and the dropdown
 * stays open, while the picked ones stack on top as a numbered list. The
 * options come ranked, so the picks follow their order — that order is the
 * priority handed to `onChange`, not the order they were clicked in.
 */
export const RankedMultiSearchSelect: React.FC<RankedMultiSearchSelectProps> = ({
  value,
  options,
  placeholder,
  rankHint,
  onChange,
}) => {
  const [keyword, setKeyword] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdown = usePortalDropdown(() => setKeyword(""));

  const picked = useMemo(() => options.filter((o) => value.includes(o.value)), [options, value]);
  const needle = keyword.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  const handleOpen = () => {
    if (dropdown.open) {
      dropdown.hide();
      return;
    }
    dropdown.show();
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue];
    // A value whose option is not loaded (yet) is kept, just not shown, after the ranked ones.
    const ranked = options.filter((o) => next.includes(o.value)).map((o) => o.value);
    onChange([...ranked, ...next.filter((v) => !ranked.includes(v))]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const panel = dropdown.open && dropdown.pos && createPortal(
    <div
      ref={dropdown.dropdownRef}
      className="ss-dropdown ms-dropdown"
      style={{ position: "absolute", top: dropdown.pos.top, left: dropdown.pos.left, width: dropdown.pos.width }}
    >
      <div className="ss-search-row">
        <span className="ss-icon ss-icon--search ss-icon--sm"><SearchIcon size={13} /></span>
        <input
          ref={searchRef}
          className="ss-search-input"
          value={keyword}
          placeholder={t("Common:Search")}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && dropdown.hide()}
        />
      </div>
      {picked.length > 0 && (
        <PriorityList items={picked} hint={rankHint} onRemove={toggle} />
      )}
      <div className="ss-options" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 && <div className="ss-empty">{t("Common:NoResults")}</div>}
        {filtered.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <div
              key={opt.value}
              role="option"
              aria-selected={selected}
              className={["ss-option", "ms-option", selected && "ss-option--selected"].filter(Boolean).join(" ")}
              title={opt.label}
              onMouseDown={(e) => {
                e.preventDefault();
                toggle(opt.value);
              }}
            >
              <span className={["ms-check", selected && "ms-check--on"].filter(Boolean).join(" ")} aria-hidden="true" />
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <div ref={dropdown.triggerRef} className={["ss-wrapper", dropdown.open && "ss-wrapper--open"].filter(Boolean).join(" ")}>
        <div
          className="ss-trigger"
          role="combobox"
          aria-expanded={dropdown.open}
          aria-haspopup="listbox"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleOpen()}
        >
          <span className="ss-icon ss-icon--search"><SearchIcon size={14} /></span>
          <span className="ss-value" title={picked.map((o) => o.label).join(", ") || undefined}>
            {picked.length > 0 ? (
              <span className="ss-value--selected">{picked[0].label}</span>
            ) : (
              <span className="ss-value--placeholder">{placeholder ?? t("Common:Search")}</span>
            )}
          </span>
          {picked.length > 1 && <span className="ms-more">+{picked.length - 1}</span>}
          {picked.length > 0 && (
            <span className="ss-icon ss-icon--clear" onMouseDown={handleClear} title={t("Common:Clear")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </span>
          )}
          <span className={["ss-icon", "ss-icon--chevron", dropdown.open && "ss-icon--chevron-up"].filter(Boolean).join(" ")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>
      {panel}
    </>
  );
};
