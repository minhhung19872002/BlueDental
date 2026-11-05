import type { ReactNode } from "react";
import { Form, Input } from "antd";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";

/** Shades are typed as the Vita guide names them, whatever the language. */
const SHADE_PLACEHOLDER = "A1/A2/A3";

type SpecPath = (string | number)[];

interface ShadeProps {
  name: SpecPath;
  /** "Màu răng R11", "Màu Gần R11" — the box has no visible label of its own. */
  label: string;
  error: boolean;
  disabled: boolean;
}

/** A Màu box (free text, several shades split by "/"). */
export function LaboShadeInput({ name, label, error, disabled }: ShadeProps) {
  return (
    <Form.Item name={name} noStyle>
      <Input
        className="pd-lts-shade"
        maxLength={100}
        placeholder={SHADE_PLACEHOLDER}
        status={error ? "error" : ""}
        disabled={disabled}
        aria-label={label}
      />
    </Form.Item>
  );
}

interface SelectProps {
  name: SpecPath;
  options: PickerOption[];
  disabled: boolean;
}

/** Đường hoàn tất / Kiểu nhịp — never required (R-1150). */
export function LaboSpecSelect({ name, options, disabled }: SelectProps) {
  return (
    <Form.Item name={name} noStyle>
      <SearchSelect allowClear options={options} placeholder={t("Labo:Spec:Choose")} disabled={disabled} />
    </Form.Item>
  );
}

interface LabelProps {
  children: ReactNode;
  required?: boolean;
}

/** The small grey label before a control, with its red star. */
export function LaboSpecLabel({ children, required }: LabelProps) {
  return (
    <span className="pd-lts-label">
      {children}
      {required && <span className="floating-field-required">*</span>}
    </span>
  );
}
