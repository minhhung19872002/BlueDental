import { useState, type KeyboardEvent } from "react";
import type { MessageVariable } from "../api/templateApi";
import { matchesVariable, quoteVariable } from "../messageVariables";

/** The `{…` the user is typing right before the caret. */
interface OpenToken {
  start: number;
  query: string;
}

const TOKEN_BEFORE_CARET = /\{([^\s{}]*)$/;

function tokenBefore(value: string, caret: number): OpenToken | null {
  const match = TOKEN_BEFORE_CARET.exec(value.slice(0, caret));
  return match ? { start: caret - match[0].length, query: match[1] } : null;
}

/** The highlighted row belongs to the query it was moved on; typing more starts again at the top. */
interface Highlight {
  query: string;
  index: number;
}

/**
 * Typing `{` in Nội dung lists the library's variables, narrowed as the user
 * types on (BA img_08: "Đang gõ {ng · ↑↓ để chọn, Enter để chèn"). Enter or Tab
 * puts the whole `{key}` in place of what was typed, Esc closes the list.
 */
export function useVariableAutocomplete(
  value: string,
  variables: readonly MessageVariable[],
  replace: (from: number, to: number, text: string) => void,
) {
  const [caret, setCaret] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Highlight>({ query: "", index: 0 });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const token = caret === null ? null : tokenBefore(value, caret);
  const openToken = token && token.start !== dismissedAt ? token : null;
  const matches = openToken ? variables.filter((variable) => matchesVariable(variable, openToken.query)) : [];
  const index = openToken && highlight.query === openToken.query ? Math.min(highlight.index, matches.length - 1) : 0;

  const track = (field: HTMLTextAreaElement | HTMLInputElement) => {
    const { selectionStart, selectionEnd } = field;
    setCaret(selectionStart !== null && selectionStart === selectionEnd ? selectionStart : null);
  };

  const pick = (variable: MessageVariable) => {
    if (!openToken || caret === null) return;
    replace(openToken.start, caret, quoteVariable(variable.key));
    setCaret(null);
  };

  const move = (step: number) => {
    if (!openToken || matches.length === 0) return;
    setHighlight({ query: openToken.query, index: (index + step + matches.length) % matches.length });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!openToken || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAt(openToken.start);
      return;
    }
    if (matches.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(matches[index]);
    }
  };

  return {
    open: openToken !== null,
    typed: openToken ? `{${openToken.query}` : "",
    matches,
    activeIndex: index,
    pick,
    track,
    close: () => setCaret(null),
    handleKeyDown,
  };
}

export type VariableAutocomplete = ReturnType<typeof useVariableAutocomplete>;
