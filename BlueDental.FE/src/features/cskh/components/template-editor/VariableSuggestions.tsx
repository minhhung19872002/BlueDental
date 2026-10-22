import { useLayoutEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import type { VariableAutocomplete } from "../../hooks/useVariableAutocomplete";
import { quoteVariable, variableLabel } from "../../messageVariables";

export function suggestionId(listId: string, key: string): string {
  return `${listId}-${key}`;
}

/** The list under Nội dung while a `{…` is being typed (BA img_08). */
export function VariableSuggestions({ listId, autocomplete }: { listId: string; autocomplete: VariableAutocomplete }) {
  const list = useRef<HTMLDivElement>(null);
  const { open, typed, matches, activeIndex, pick } = autocomplete;

  // Arrowing past the visible rows scrolls the highlighted one into view.
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, typed]);

  if (!open) return null;
  return (
    <div className="tpe-suggest">
      <div className="tpe-suggest-head">{t("CSKH:Template:Typing", typed)}</div>
      <div ref={list} id={listId} role="listbox" aria-label={t("CSKH:Template:Library")} className="tpe-suggest-list">
        {matches.length === 0 && <div className="tpe-suggest-empty">{t("CSKH:Template:NoMatch")}</div>}
        {matches.map((variable, index) => (
          <div
            key={variable.key}
            id={suggestionId(listId, variable.key)}
            role="option"
            aria-selected={index === activeIndex}
            className={["tpe-suggest-row", index === activeIndex && "tpe-suggest-row--active"].filter(Boolean).join(" ")}
            // Keeps the caret in Nội dung, so the pick replaces what was typed.
            onMouseDown={(event) => {
              event.preventDefault();
              pick(variable);
            }}
          >
            <span>{variableLabel(variable.key)}</span>
            <code className="tpe-key">{quoteVariable(variable.key)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
