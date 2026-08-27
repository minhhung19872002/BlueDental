import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** When set, the option renders as a colored tag chip (Thẻ hồ sơ style). */
  color?: string;
}

/** The reference renders tag options as colored chips with a small tag icon. */
function renderOptionLabel(option: SearchSelectOption): React.ReactNode {
  if (!option.color) return option.label;
  return (
    <span className="bd-tag-chip ss-tag-chip" style={{ backgroundColor: option.color }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
      {option.label}
    </span>
  );
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

interface SearchSelectProps {
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
  /** Reported the way AntD pickers report it, so floating-label wrappers work. */
  onOpenChange?: (open: boolean) => void;
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
  onOpenChange,
}) => {
  const resolvedPlaceholder = placeholder ?? t("Tìm kiếm...");
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = keyword.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(keyword.trim().toLowerCase())
      )
    : options;

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setKeyword("");
    onOpenChange?.(false);
  }, [onOpenChange]);

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

  const handleOpen = useCallback(() => {
    if (disabled) return;
    calcPos();
    setOpen(true);
    setKeyword("");
    onOpenChange?.(true);
    setTimeout(() => searchRef.current?.focus(), 30);
  }, [disabled, calcPos, onOpenChange]);

  const handleSelect = useCallback(
    (opt: SearchSelectOption) => {
      onChange?.(opt.value);
      closeDropdown();
    },
    [onChange, closeDropdown]
  );

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
    onSearch?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      closeDropdown();
    }
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
                ref={searchRef}
                className="ss-search-input"
                value={keyword}
                placeholder={t("Tìm kiếm...")}
                onChange={handleKeywordChange}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="ss-options">
              {filtered.length === 0 ? (
                <div className="ss-empty">{emptyText ?? t("Không tìm thấy kết quả")}</div>
              ) : (
                filtered.map((opt) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    className={`ss-option${opt.value === value ? " ss-option--selected" : ""}`}
                    title={opt.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                  >
                    {renderOptionLabel(opt)}
                  </div>
                ))
              )}
            </div>
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
          tabIndex={disabled ? -1 : 0}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleOpen();
          }}
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
              title={t("Xóa")}
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
