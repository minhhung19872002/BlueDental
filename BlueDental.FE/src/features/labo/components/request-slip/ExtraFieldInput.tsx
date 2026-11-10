import type { ReactElement } from "react";
import { DatePicker, Input, Select } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { LABO_FIELD_TYPE, type LaboFieldType } from "@/features/labo/api/laboFormTemplateApi";
import type { ExtraField } from "./extraFormModel";

interface InputProps {
  field: ExtraField;
  values: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}

const one = (value: string | null | undefined): string[] => (value ? [value] : []);

/** Digits with one decimal point, a comma typed as the point; anything else is not taken. */
const NUMBER_DRAFT = /^-?\d*(\.\d*)?$/;

function TextInput({ field, values, disabled, onChange }: InputProps) {
  return (
    <Input
      value={values[0] ?? ""}
      maxLength={500}
      disabled={disabled}
      aria-label={field.label}
      onChange={(event) => onChange(one(event.target.value))}
    />
  );
}

function LongTextInput({ field, values, disabled, onChange }: InputProps) {
  return (
    <Input.TextArea
      value={values[0] ?? ""}
      maxLength={4000}
      autoSize={{ minRows: 2, maxRows: 6 }}
      disabled={disabled}
      aria-label={field.label}
      onChange={(event) => onChange(one(event.target.value))}
    />
  );
}

function NumberInput({ field, values, disabled, onChange }: InputProps) {
  const handleChange = (raw: string) => {
    const typed = raw.replace(",", ".");
    if (NUMBER_DRAFT.test(typed)) onChange(one(typed));
  };
  // "12." and a lone "-" are steps on the way to a number, not one.
  const handleBlur = () => {
    const typed = values[0] ?? "";
    onChange(one(typed === "-" || typed === "." ? "" : typed.replace(/\.$/, "")));
  };
  return (
    <Input
      value={values[0] ?? ""}
      inputMode="decimal"
      maxLength={30}
      disabled={disabled}
      aria-label={field.label}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
    />
  );
}

function DateInput({ field, values, disabled, onChange }: InputProps) {
  const stored = values[0] ? dayjs(values[0], "YYYY-MM-DD") : null;
  return (
    <DatePicker
      className="rs-extra-date"
      format="DD/MM/YYYY"
      value={stored?.isValid() ? stored : null}
      disabled={disabled}
      aria-label={field.label}
      onChange={(date) => onChange(one(date?.format("YYYY-MM-DD")))}
    />
  );
}

function SelectInput({ field, values, disabled, onChange }: InputProps) {
  return (
    <Select
      allowClear
      value={values[0]}
      disabled={disabled}
      aria-label={field.label}
      placeholder={t("Common:PleaseSelect", field.label)}
      options={field.options.map((option) => ({ value: option, label: option }))}
      onChange={(value: string | undefined) => onChange(one(value))}
    />
  );
}

function MultiSelectInput({ field, values, disabled, onChange }: InputProps) {
  return (
    <Select
      mode="multiple"
      allowClear
      value={values}
      disabled={disabled}
      aria-label={field.label}
      placeholder={t("Common:PleaseSelect", field.label)}
      options={field.options.map((option) => ({ value: option, label: option }))}
      onChange={(picked: string[]) => onChange(picked)}
    />
  );
}

function YesNoInput({ field, values, disabled, onChange }: InputProps) {
  return (
    <Select
      allowClear
      value={values[0]}
      disabled={disabled}
      aria-label={field.label}
      options={[
        { value: "true", label: t("Common:Yes") },
        { value: "false", label: t("Common:No") },
      ]}
      onChange={(value: string | undefined) => onChange(one(value))}
    />
  );
}

/** The control each kind of field is answered with; every answer is text. */
const INPUTS: Record<LaboFieldType, (props: InputProps) => ReactElement> = {
  [LABO_FIELD_TYPE.Text]: TextInput,
  [LABO_FIELD_TYPE.LongText]: LongTextInput,
  [LABO_FIELD_TYPE.Number]: NumberInput,
  [LABO_FIELD_TYPE.Date]: DateInput,
  [LABO_FIELD_TYPE.Select]: SelectInput,
  [LABO_FIELD_TYPE.MultiSelect]: MultiSelectInput,
  [LABO_FIELD_TYPE.YesNo]: YesNoInput,
};

/** One field of Thông tin bổ sung with its label; a Bắt buộc one left blank is marked. */
export function ExtraFieldInput(props: InputProps) {
  const { field, values } = props;
  const Control = INPUTS[field.type];
  const missing = field.required && !values.some((value) => value.trim() !== "");
  const wide = field.type === LABO_FIELD_TYPE.LongText;
  return (
    <div className={["rs-extra-field", wide && "rs-extra-field--wide", missing && "is-missing"].filter(Boolean).join(" ")}>
      <span className="rs-extra-label">
        {field.label}
        {field.required && <em className="rs-extra-req"> *</em>}
      </span>
      <Control {...props} />
    </div>
  );
}
