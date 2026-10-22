import { AutoComplete } from "antd";
import { t } from "@/lib/i18n";
import type { MessageVariable, ZnsTemplateParam } from "../../api/templateApi";
import { matchesVariable, quoteVariable, variableLabel } from "../../messageVariables";

interface ZnsParamRowProps {
  param: ZnsTemplateParam;
  value: string;
  variables: readonly MessageVariable[];
  readOnly: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
}

/** One ZNS parameter: a library variable picked from the list, or plain text typed in. */
export function ZnsParamRow({ param, value, variables, readOnly, onChange, onFocus }: ZnsParamRowProps) {
  const id = `tpe-zns-${param.name}`;
  const byToken = new Map(variables.map((variable) => [quoteVariable(variable.key), variable]));
  const options = variables.map((variable) => ({
    value: quoteVariable(variable.key),
    label: (
      <span className="tpe-option">
        <span>{variableLabel(variable.key)}</span>
        <code className="tpe-key">{quoteVariable(variable.key)}</code>
      </span>
    ),
  }));

  return (
    <div className="tpe-zns-param">
      <label className="tpe-zns-name" htmlFor={id}>
        <code>{param.name}</code>
        {param.required && <span className="tpe-required" aria-hidden="true">*</span>}
      </label>
      <div className="tpe-zns-value">
        <AutoComplete
          id={id}
          value={value}
          options={options}
          disabled={readOnly}
          placeholder={t("CSKH:Template:ZnsParamPlaceholder")}
          filterOption={(input, option) => {
            const variable = option?.value ? byToken.get(String(option.value)) : undefined;
            return !!variable && matchesVariable(variable, input.replace(/[{}]/g, ""));
          }}
          onChange={onChange}
          onFocus={onFocus}
          aria-required={param.required}
        />
        {param.maxLength !== null && (
          <span className="tpe-hint">{t("CSKH:Template:ZnsMaxLength", param.maxLength)}</span>
        )}
      </div>
    </div>
  );
}
