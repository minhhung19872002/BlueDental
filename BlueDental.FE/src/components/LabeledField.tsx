import type { InputHTMLAttributes, KeyboardEvent } from "react";
import { Input, InputNumber } from "antd";

interface Props
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "id" | "type" | "size"
  > {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "tel" | "number";
  required?: boolean;
  error?: string;
  className?: string;
}

/**
 * A labelled text field for dialogs that hold their own state.
 *
 * {@link FloatingField} is the house floating-label wrapper, but it reads its
 * value from an Ant Design Form instance. The catalog dialogs edit tables, a
 * rich-text body and an A4 sheet alongside their inputs, so they keep plain
 * React state and use this instead.
 */
export function LabeledField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  error,
  className,
  autoFocus,
  readOnly,
  min,
  inputMode,
  onKeyDown,
  ...rest
}: Props) {
  const shared = {
    id,
    autoFocus,
    readOnly,
    status: error ? ("error" as const) : undefined,
    onKeyDown: onKeyDown as ((event: KeyboardEvent<HTMLInputElement>) => void) | undefined,
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="bd-field-label">
        {label}
        {required && <span className="bd-field-required">*</span>}
      </label>

      {type === "number" ? (
        <InputNumber
          {...shared}
          min={typeof min === "number" ? min : 0}
          value={value === "" ? null : Number(value)}
          onChange={(next) => onChange(next === null ? "" : String(next))}
          style={{ width: "100%" }}
        />
      ) : (
        <Input
          {...rest}
          {...shared}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {error && (
        <p role="alert" className="bd-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
