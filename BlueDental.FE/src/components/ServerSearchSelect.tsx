import { useState } from "react";
import { Select, Spin } from "antd";
import { ChevronDown, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";

export interface ServerSearchOption {
  value: string;
  label: string;
}

interface Props {
  /** Bound by the surrounding Form.Item — not passed by hand. */
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** The picked option itself, for callers that print its label elsewhere. */
  onPick?: (option: ServerSearchOption | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  /**
   * FloatingField clones these onto whatever it wraps — the id ties its label
   * to the control, and the focus callbacks are how it knows to float. They are
   * passed straight through rather than swallowed.
   */
  id?: string;
  placeholder?: string;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  onOpenChange?: (open: boolean) => void;
  /** What to fetch for a term. Called with the debounced text, "" when idle. */
  useOptions: (search: string, enabled: boolean) => {
    options: ServerSearchOption[];
    loading: boolean;
  };
  notFoundText?: string;
  /**
   * What `value` is called, for a value the caller already knows the name of.
   * Without it a preset id outside the first page of results has nothing to
   * render and the field shows the raw id.
   */
  valueLabel?: string | null;
  "aria-label"?: string;
}

/**
 * A picker that asks the server on every keystroke.
 *
 * The house pickers hold one capped page and match it in the browser, so on a
 * clinic whose list outgrows that page the rest simply cannot be found by
 * typing. This sends the term instead, debounced, and never matches again on
 * this side — the server has already decided what matches.
 *
 * The option in `value` is merged back in when a later search no longer
 * contains it, so a chosen name never blanks out.
 */
export function ServerSearchSelect({
  value,
  onChange,
  onPick,
  disabled,
  allowClear = true,
  id,
  placeholder,
  onFocus,
  onBlur,
  onOpenChange,
  useOptions,
  notFoundText,
  valueLabel,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const { options, loading } = useOptions(debounced, open || Boolean(value));

  // Keep whatever is selected on the list even once the search has moved past
  // it — either what was picked here, or the name the caller came in with.
  const [chosen, setChosen] = useState<ServerSearchOption | null>(null);
  const known: ServerSearchOption | null =
    chosen && value === chosen.value
      ? chosen
      : value && valueLabel
        ? { value, label: valueLabel }
        : null;
  const merged =
    known && !options.some((option) => option.value === known.value)
      ? [...options, known]
      : options;

  return (
    <Select<string, ServerSearchOption>
      showSearch
      allowClear={allowClear}
      disabled={disabled}
      id={id}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      value={value}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
        onOpenChange?.(next);
      }}
      searchValue={search}
      onSearch={setSearch}
      // The server narrowed the list; matching again here would drop rows whose
      // match is on something other than the label.
      filterOption={false}
      loading={loading}
      options={merged}
      aria-label={ariaLabel}
      prefix={<Search size={20} aria-hidden="true" />}
      suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
      notFoundContent={loading ? <Spin size="small" /> : (notFoundText ?? t("Không tìm thấy kết quả"))}
      onChange={(next, option) => {
        const picked = Array.isArray(option) ? null : (option ?? null);
        setChosen(picked);
        onPick?.(picked);
        onChange?.(next);
      }}
    />
  );
}
