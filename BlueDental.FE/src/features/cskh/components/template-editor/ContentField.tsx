import { useId, type ChangeEvent } from "react";
import { Input } from "antd";
import { t } from "@/lib/i18n";
import type { MessageVariable } from "../../api/templateApi";
import type { CaretField } from "../../hooks/useCaretField";
import { useVariableAutocomplete } from "../../hooks/useVariableAutocomplete";
import { suggestionId, VariableSuggestions } from "./VariableSuggestions";

interface ContentFieldProps {
  value: string;
  field: CaretField;
  variables: readonly MessageVariable[];
  readOnly: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
}

/** Nội dung, with the `{` suggestions under it. */
export function ContentField({ value, field, variables, readOnly, onChange, onFocus }: ContentFieldProps) {
  const listId = useId();
  const autocomplete = useVariableAutocomplete(value, variables, field.replace);
  const active = autocomplete.open ? autocomplete.matches[autocomplete.activeIndex] : undefined;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    autocomplete.track(event.target);
  };

  return (
    <div className="tpe-field">
      <label className="tpe-label" htmlFor="tpe-content">
        {t("CSKH:Template:Content")}
      </label>
      <div className="tpe-content-wrap">
        <Input.TextArea
          id="tpe-content"
          ref={(ref) => {
            field.element.current = ref?.resizableTextArea?.textArea ?? null;
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={autocomplete.open}
          aria-controls={listId}
          aria-activedescendant={active ? suggestionId(listId, active.key) : undefined}
          value={value}
          readOnly={readOnly}
          autoSize={{ minRows: 4, maxRows: 14 }}
          placeholder={t("CSKH:Template:ContentPlaceholder")}
          onChange={handleChange}
          onSelect={(event) => autocomplete.track(event.currentTarget)}
          onKeyDown={autocomplete.handleKeyDown}
          onFocus={onFocus}
          onBlur={autocomplete.close}
        />
        <VariableSuggestions listId={listId} autocomplete={autocomplete} />
      </div>
    </div>
  );
}
