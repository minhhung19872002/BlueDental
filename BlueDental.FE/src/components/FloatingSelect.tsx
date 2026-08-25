import { Select } from "antd";
import { t } from "@/lib/i18n";

export interface FloatingSelectOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FloatingSelectOption[];
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A labelled select for the dialogs that hold their own state rather than an
 * Ant Design Form — {@link FloatingField} needs a Form instance, and these
 * dialogs edit tables and canvases alongside their fields.
 */
export function FloatingSelect({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
  disabled,
  className,
}: Props) {
  return (
    <div className={className}>
      <label htmlFor={id} className="bd-field-label">
        {label}
        {required && <span className="bd-field-required">*</span>}
      </label>
      <Select
        id={id}
        value={value || undefined}
        onChange={onChange}
        options={options}
        disabled={disabled}
        status={error ? "error" : undefined}
        showSearch
        optionFilterProp="label"
        placeholder={t("Chọn…")}
        style={{ width: "100%" }}
      />
      {error && (
        <p role="alert" className="bd-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
