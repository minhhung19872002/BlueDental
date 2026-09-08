import { Form } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { useChipScroller } from "./useChipScroller";

interface Props {
  id?: string;
  label: string;
  options: PickerOption[];
  value?: string;
  empty: string;
  dimmed?: boolean;
  onChange?: (value: string | undefined) => void;
}

/**
 * One of the reference's chip strips: the choices in a two-row carousel with
 * a round arrow on each side, a dashed pill in place of an empty list, and a
 * chip that is clicked again to let go of the choice. Shaped as a form
 * control (value/onChange) so a Form.Item can carry its rule and paint the
 * label red with the helper text.
 */
export function ChipStrip({ id, label, options, value, empty, dimmed, onChange }: Props) {
  const { status } = Form.Item.useStatus();
  const scroller = useChipScroller(options.length);
  const className = [
    "pd-labo-strip",
    dimmed && "pd-labo-strip--off",
    status === "error" && "pd-labo-strip--error",
  ]
    .filter(Boolean)
    .join(" ");

  const pick = (optionValue: string) => onChange?.(optionValue === value ? undefined : optionValue);

  return (
    <div id={id} className={className}>
      <p>
        {label}
        <span className="floating-field-required">*</span>
      </p>
      {options.length === 0 ? (
        <span className="pd-labo-emptypill">{empty}</span>
      ) : (
        <div className="pd-labo-carousel">
          <button
            type="button"
            className="pd-labo-arrow"
            aria-label={t("Trượt {0} sang trái", label)}
            disabled={!scroller.canPrev}
            onClick={scroller.prev}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="pd-labo-chips" ref={scroller.ref} onScroll={scroller.onScroll}>
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={value === option.value ? "active" : undefined}
                aria-pressed={value === option.value}
                onClick={() => pick(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pd-labo-arrow"
            aria-label={t("Trượt {0} sang phải", label)}
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
