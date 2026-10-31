import { useId } from "react";
import { InputNumber } from "antd";
import { t } from "@/lib/i18n";
import { CATALOG_DURATION, durationLabel, MAX_WARRANTY_MONTHS, WARRANTY_DURATIONS } from "./laboWarrantyRules";

interface Props {
  /** Months; set by the Form.Item around it. */
  value?: number;
  onChange?: (months: number | undefined) => void;
  disabled?: boolean;
  id?: string;
  /** Danh mục's days: shows "Theo danh mục · n ngày" first, held as {@link CATALOG_DURATION} (P3110 REQ-B5). */
  catalogDays?: number;
}

const isPreset = (months: number | undefined) =>
  months === CATALOG_DURATION || WARRANTY_DURATIONS.some((preset) => preset === months);

/**
 * Thời hạn bảo hành: 6 tháng … 10 năm as chips, or Khác (tháng) for any
 * whole number of months. Either way the form holds one number of months.
 */
export function LaboWarrantyDurationPicker({ value, onChange, disabled, id, catalogDays }: Props) {
  const customId = useId();
  return (
    <div className="pd-labo-warranty-durations" id={id}>
      {catalogDays !== undefined && (
        <button
          type="button"
          className={["pd-labo-warranty-duration", value === CATALOG_DURATION && "pd-labo-warranty-duration--on"]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={value === CATALOG_DURATION}
          disabled={disabled}
          onClick={() => onChange?.(CATALOG_DURATION)}
        >
          {t("Treatment:Warranty:ByCatalog", catalogDays)}
        </button>
      )}
      {WARRANTY_DURATIONS.map((months) => {
        const label = durationLabel(months);
        return (
          <button
            key={months}
            type="button"
            className={["pd-labo-warranty-duration", value === months && "pd-labo-warranty-duration--on"]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={value === months}
            disabled={disabled}
            onClick={() => onChange?.(months)}
          >
            {t(label.key, label.value)}
          </button>
        );
      })}
      {/* Khác (tháng) sits on the border as the dialog's other labels do (mock). */}
      <div className="floating-field floating-field--floated pd-labo-warranty-custom-field">
        <InputNumber
          id={customId}
          className="pd-labo-warranty-custom"
          placeholder={t("Labo:Warranty:CustomMonthsPlaceholder")}
          min={1}
          max={MAX_WARRANTY_MONTHS}
          precision={0}
          controls={false}
          disabled={disabled}
          value={isPreset(value) ? null : value}
          onChange={(months) => onChange?.(months ?? undefined)}
        />
        <label htmlFor={customId} className="floating-field-label">
          {t("Labo:Warranty:CustomMonths")}
        </label>
      </div>
    </div>
  );
}
