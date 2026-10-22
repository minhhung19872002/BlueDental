import { useState } from "react";
import { Input } from "antd";
import { CheckOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { PillTabs } from "@/components/PillTabs";
import type { MessageVariable, VariableGroup } from "../../api/templateApi";
import { matchesVariable, quoteVariable, VARIABLE_GROUPS, variableGroupLabels, variableLabel } from "../../messageVariables";
import { CountPill } from "../templates/CountPill";
import { EditorCard } from "./EditorCard";

const ALL_GROUPS = "all";

interface VariableLibraryProps {
  variables: readonly MessageVariable[];
  usedKeys: ReadonlySet<string>;
  disabled: boolean;
  onInsert: (key: string) => void;
}

function LibraryRow({ variable, used, disabled, onInsert }: { variable: MessageVariable; used: boolean; disabled: boolean; onInsert: (key: string) => void }) {
  const label = variableLabel(variable.key);
  return (
    <li className="tpe-lib-row">
      <div className="tpe-lib-text">
        <span className="tpe-lib-name">{label}</span>
        <span className="tpe-lib-example">{t("CSKH:Template:Example", variable.example)}</span>
      </div>
      <code className="tpe-key">{quoteVariable(variable.key)}</code>
      <button
        type="button"
        className={["tpe-lib-add", used && "tpe-lib-add--used"].filter(Boolean).join(" ")}
        aria-label={t("CSKH:Template:InsertVar", label)}
        disabled={disabled}
        // The text box keeps focus and caret, so the insert lands there.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onInsert(variable.key)}
      >
        {used ? <CheckOutlined /> : <PlusOutlined />}
      </button>
    </li>
  );
}

/** Thư viện biến: every variable a template may use, searchable and by group. */
export function VariableLibrary({ variables, usedKeys, disabled, onInsert }: VariableLibraryProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(ALL_GROUPS);
  const labels = variableGroupLabels();
  const found = variables.filter((variable) => matchesVariable(variable, query));
  const inGroup = (key: VariableGroup) => found.filter((variable) => variable.group === key);

  const items = [
    { key: ALL_GROUPS, label: <CountPill label={t("CSKH:Template:AllVars")} count={found.length} /> },
    ...VARIABLE_GROUPS.map((key) => ({
      key: `${key}`,
      label: <CountPill label={labels[key]} count={inGroup(key).length} />,
    })),
  ];
  const shown = VARIABLE_GROUPS.filter((key) => group === ALL_GROUPS || `${key}` === group)
    .map((key) => ({ key, rows: inGroup(key) }))
    .filter((section) => section.rows.length > 0);

  return (
    <EditorCard
      className="tpe-lib"
      title={t("CSKH:Template:Library")}
      extra={<span className="tpe-card-hint">{t("CSKH:Template:LibraryHint")}</span>}
    >
      <Input
        allowClear
        aria-label={t("CSKH:Template:LibrarySearch")}
        placeholder={t("CSKH:Template:LibrarySearch")}
        prefix={<SearchOutlined />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <PillTabs className="tpe-lib-groups" items={items} activeKey={group} onChange={setGroup} />
      <div className="tpe-lib-list">
        {shown.length === 0 && <p className="tpl-muted">{t("CSKH:Template:NoMatch")}</p>}
        {shown.map((section) => (
          <div key={section.key} className="tpe-lib-section">
            <h3 className="tpl-eyebrow">{labels[section.key]}</h3>
            <ul className="tpe-lib-rows">
              {section.rows.map((variable) => (
                <LibraryRow
                  key={variable.key}
                  variable={variable}
                  used={usedKeys.has(variable.key)}
                  disabled={disabled}
                  onInsert={onInsert}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </EditorCard>
  );
}
