import { CloseOutlined, WarningOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { MessageVariable } from "../../api/templateApi";
import { quoteVariable, variableLabel, whenEmptyLabel } from "../../messageVariables";

interface VariablesInUseProps {
  keys: readonly string[];
  variables: readonly MessageVariable[];
  readOnly: boolean;
  onRemove: (key: string) => void;
}

/**
 * "Biến đang dùng trong mẫu (N)": each variable with what a customer without
 * that value gets, and an × that takes it out of the text. A `{key}` the
 * library does not know is called out, since the server refuses to save it.
 */
export function VariablesInUse({ keys, variables, readOnly, onRemove }: VariablesInUseProps) {
  if (keys.length === 0) return null;
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  const unknown = keys.filter((key) => !byKey.has(key));

  return (
    <div className="tpe-inuse">
      <div className="tpe-label">{t("CSKH:Template:InUse", keys.length)}</div>
      <div className="tpe-chips">
        {keys.map((key) => {
          const variable = byKey.get(key);
          return (
            <span key={key} className={["tpe-inuse-chip", !variable && "tpe-inuse-chip--unknown"].filter(Boolean).join(" ")}>
              <span className="tpe-inuse-name">{variable ? variableLabel(key) : quoteVariable(key)}</span>
              {variable && <span className="tpe-inuse-empty">· {whenEmptyLabel(variable)}</span>}
              {!readOnly && (
                <button
                  type="button"
                  className="tpe-inuse-remove"
                  aria-label={t("CSKH:Template:RemoveVar", quoteVariable(key))}
                  onClick={() => onRemove(key)}
                >
                  <CloseOutlined />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {unknown.length > 0 && (
        <p className="tpe-warn" role="alert">
          <WarningOutlined />
          {t("CSKH:Template:UnknownVars", unknown.map(quoteVariable).join(", "))}
        </p>
      )}
    </div>
  );
}
