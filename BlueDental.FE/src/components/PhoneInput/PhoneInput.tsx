import { useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";

import { Input, Select, Space } from "antd";

import { useT } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";

import { dialCodeOf } from "./countries";
import { composePhone, parsePhone, readTyped } from "./phoneValue";
import { useCountryOptions } from "./useCountryOptions";
import type { CountryOption } from "./useCountryOptions";
import type { PhoneParts } from "./phoneValue";
import "./PhoneInput.css";

export interface PhoneInputProps {
  /** "0901234567" for Vietnam, "+14155550123" abroad, "" for none. */
  value?: string;
  onChange?: (value: string) => void;
  /** Lands on the number box, so a FloatingField label names it. */
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** The country list opening and closing — a FloatingField floats its label on it. */
  onOpenChange?: (open: boolean) => void;
}

interface Draft extends PhoneParts {
  value: string;
}

function Flag({ iso }: { iso: string }) {
  return <span className={`fi fi-${iso.toLowerCase()} phone-input-flag`} aria-hidden />;
}

function filterCountry(input: string, option?: CountryOption): boolean {
  return option?.search.includes(foldForSearch(input)) ?? false;
}

function renderOption({ data }: { data: CountryOption }) {
  return (
    <span className="phone-input-option">
      <Flag iso={data.value} />
      <span className="phone-input-option-name">{data.label}</span>
      <span className="phone-input-option-dial">+{data.dial}</span>
    </span>
  );
}

function renderSelected({ value }: { value?: string | number }) {
  const iso = String(value);
  return (
    <span className="phone-input-selected">
      <Flag iso={iso} />
      <span>+{dialCodeOf(iso)}</span>
    </span>
  );
}

/**
 * A phone field with its country: a flag and calling code picked from a
 * searchable list, then the number. Vietnamese numbers keep their national
 * form, foreign ones are composed into E.164 — see phoneValue.ts.
 */
export function PhoneInput({ value, onChange, id, placeholder, disabled, onFocus, onBlur, onOpenChange }: PhoneInputProps) {
  const t = useT();
  const options = useCountryOptions();
  const current = value ?? "";
  const [draft, setDraft] = useState<Draft>(() => ({ value: current, ...parsePhone(current) }));

  // A value set from outside (form reset, prefill) is read afresh; the
  // country picked by hand stays while its code still fits.
  if (current !== draft.value) {
    setDraft({ value: current, ...parsePhone(current, draft.iso) });
  }

  const commit = (iso: string, national: string) => {
    const composed = composePhone(iso, national);
    setDraft({ iso, ...composed });
    if (composed.value !== current) onChange?.(composed.value);
  };

  const handleCountryChange = (iso: string) => commit(iso, draft.national);

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const typed = readTyped(event.target.value, draft.iso);
    commit(typed.iso, typed.national);
  };

  return (
    <Space.Compact block className="phone-input">
      <Select<string, CountryOption>
        className="phone-input-country"
        aria-label={t("Common:Phone:Country")}
        value={draft.iso}
        options={options}
        disabled={disabled}
        showSearch={{ filterOption: filterCountry }}
        labelRender={renderSelected}
        optionRender={renderOption}
        popupMatchSelectWidth={300}
        listHeight={288}
        notFoundContent={t("Common:Phone:NoCountry")}
        onChange={handleCountryChange}
        onOpenChange={onOpenChange}
      />
      <Input
        id={id}
        className="phone-input-number"
        type="tel"
        autoComplete="off"
        inputMode="tel"
        value={draft.national}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleNumberChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </Space.Compact>
  );
}
