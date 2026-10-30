import { useEffect } from "react";
import { Form, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { useChipScroller } from "@/hooks/useChipScroller";
import { matchesSearch } from "@/utils/foldForSearch";

/** A search box beside the label that narrows the chips (R-1062). */
export interface ChipSearch {
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  /** The dashed pill when no chip matches the query. */
  noMatch: string;
}

interface Props {
  id?: string;
  label: string;
  options: PickerOption[];
  value?: string;
  empty: string;
  dimmed?: boolean;
  /** A read-only order: only the chosen chip is shown, and it cannot be let go. */
  disabled?: boolean;
  search?: ChipSearch;
  onChange?: (value: string | undefined) => void;
}

/**
 * One of the reference's chip strips: the choices in a one-row carousel with
 * a round arrow on each side, a dashed pill in place of an empty list, and a
 * chip that is clicked again to let go of the choice. Shaped as a form
 * control (value/onChange) so a Form.Item can carry its rule and paint the
 * label red with the helper text.
 *
 * With `search`, a box beside the label hides the chips that do not match,
 * blind to case and marks. The choice outlives its chip being hidden.
 */
export function ChipStrip({ id, label, options, value, empty, dimmed, disabled, search, onChange }: Props) {
  const { status } = Form.Item.useStatus();
  const query = search?.query ?? "";
  const shown = disabled
    ? options.filter((option) => option.value === value)
    : query
      ? options.filter((option) => matchesSearch(option.label, query))
      : options;
  const scroller = useChipScroller(shown.length);
  const scrollerRef = scroller.ref;
  const className = [
    "pd-labo-strip",
    dimmed && "pd-labo-strip--off",
    status === "error" && "pd-labo-strip--error",
  ]
    .filter(Boolean)
    .join(" ");

  // A new query shows its matches from the first one.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [query, scrollerRef]);

  const pick = (optionValue: string) => onChange?.(optionValue === value ? undefined : optionValue);

  return (
    <div id={id} className={className}>
      <div className="pd-labo-strip-head">
        <p>
          {label}
          <span className="floating-field-required">*</span>
        </p>
        {search && (
          // A status of its own: a missing choice reddens the label and the hint, not the box.
          <Form.Item noStyle validateStatus="">
            <Input
              className="pd-labo-strip-search"
              size="small"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              value={search.query}
              disabled={disabled || dimmed || options.length === 0}
              onChange={(event) => search.onQuery(event.target.value)}
              // Enter in a text box would submit the order form.
              onPressEnter={(event) => event.preventDefault()}
            />
          </Form.Item>
        )}
      </div>
      {shown.length === 0 ? (
        <span className="pd-labo-emptypill">{options.length > 0 && search ? search.noMatch : empty}</span>
      ) : (
        <div className="pd-labo-carousel">
          <button
            type="button"
            className="pd-labo-arrow"
            aria-label={t("Patient:Labo:SlideLeft", label)}
            disabled={!scroller.canPrev}
            onClick={scroller.prev}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="pd-labo-chips" ref={scroller.ref} onScroll={scroller.onScroll}>
            {shown.map((option) => (
              <button
                type="button"
                key={option.value}
                className={value === option.value ? "active" : undefined}
                aria-pressed={value === option.value}
                disabled={disabled}
                onClick={() => pick(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pd-labo-arrow"
            aria-label={t("Patient:Labo:SlideRight", label)}
            disabled={!scroller.canNext}
            onClick={scroller.next}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
