import { t } from "@/lib/i18n";
import type { MessageVariable } from "../../api/templateApi";
import { variableLabel } from "../../messageVariables";

interface CommonVariableChipsProps {
  variables: readonly MessageVariable[];
  disabled: boolean;
  onInsert: (key: string) => void;
}

/** "Biến hay dùng": one click puts the variable where the user was typing. */
export function CommonVariableChips({ variables, disabled, onInsert }: CommonVariableChipsProps) {
  const common = variables.filter((variable) => variable.isCommon);
  if (common.length === 0) return null;
  return (
    <div className="tpe-field">
      <div className="tpe-field-head">
        <span className="tpe-label">{t("CSKH:Template:CommonVars")}</span>
        <span className="tpe-card-hint">{t("CSKH:Template:CommonVarsHint", "{")}</span>
      </div>
      <div className="tpe-chips">
        {common.map((variable) => (
          <button
            key={variable.key}
            type="button"
            className="tpe-chip"
            disabled={disabled}
            // The text box keeps focus and caret, so the insert lands there.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(variable.key)}
          >
            + {variableLabel(variable.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
