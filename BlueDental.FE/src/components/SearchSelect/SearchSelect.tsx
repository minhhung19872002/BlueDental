import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";

export interface SearchSelectOption {
  value: string;
  label: string;
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
  required?: boolean;
  status?: "error" | "";
  style?: React.CSSProperties;
  inline?: boolean;
  onChange?: (value: string | undefined) => void;
  onSearch?: (keyword: string) => void;
}

export const SearchSelect: React.FC<SearchSelectProps> = ({
  value,
  options,
  placeholder,
  disabled = false,
  allowClear = false,
  required = false,
  status,
  style,
  inline = false,
  onChange,
  onSearch,
}) => {
  const resolvedPlaceholder = placeholder ?? t("Tìm kiếm...");
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = keyword.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(keyword.trim().toLowerCase())
      )
    : options;

  const calcPos = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    if (inline) {
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [inline]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setKeyword("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
    setTimeout(() => searchRef.current?.focus(), 30);
  }, [disabled, calcPos]);

  const handleSelect = useCallback(
    (opt: SearchSelectOption) => {
      onChange?.(opt.value);
      setOpen(false);
      setKeyword("");
    },
    [onChange]
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
      setOpen(false);
      setKeyword("");
    }
  };

  const isError = status === "error";

  const dropdownContent = open && dropdownPos ? (
    <div
      ref={dropdownRef}
      className="ss-dropdown"
      role="listbox"
      data-radix-scroll-area=""
      style={{
        position: inline ? "fixed" : "absolute",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        pointerEvents: "auto",
        overscrollBehavior: "contain",
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
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
          <div className="ss-empty">{t("Không tìm thấy kết quả")}</div>
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
              {opt.label}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={wrapperRef}
      className={`ss-wrapper${open ? " ss-wrapper--open" : ""}${isError ? " ss-wrapper--error" : ""}${disabled ? " ss-wrapper--disabled" : ""}`}
      style={{ ...style, position: inline ? "relative" : style?.position }}
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
            <span className="ss-value--selected">{selectedOption.label}</span>
          ) : (
            <span className="ss-value--placeholder">
              {resolvedPlaceholder}
              {required && <span style={{ color: "var(--color-destructive, #e53e3e)" }}>*</span>}
            </span>
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

      {dropdownContent ? createPortal(dropdownContent, document.body) : null}
    </div>
  );
};
