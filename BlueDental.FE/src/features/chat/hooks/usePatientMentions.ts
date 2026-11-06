import { useLayoutEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useChatPatientSuggestions } from "../api/chatQueries";
import { CHAT_LIMITS, type ChatPatientSuggestionDto, type PatientSuggestStatus } from "../types";
import {
  findMentionQuery,
  mentionEndingAt,
  mentionLabel,
  mentionsInText,
  safeMentionName,
  type ChatMention,
} from "../utils/chatPatientTokens";

const SUGGEST_DEBOUNCE_MS = 250;

interface PatientMentionsOptions {
  conversationId: string;
  text: string;
  setText: (text: string) => void;
  mentions: ChatMention[];
  setMentions: (mentions: ChatMention[]) => void;
  /** The text box, to read and place the caret. */
  getInput: () => HTMLTextAreaElement | null;
}

/**
 * The # list of the composer (R-1161). Typing # at the start or after a space
 * opens it; ↑↓ move, Enter or Tab picks, Esc closes. A pick writes `#Tên ` in
 * place of what was typed, and Backspace right after a tag takes it whole.
 */
export function usePatientMentions({ conversationId, text, setText, mentions, setMentions, getInput }: PatientMentionsOptions) {
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const found = findMentionQuery(text, caret, mentions, CHAT_LIMITS.maxPatientSearchLength);
  const query = found && found.start !== dismissedStart ? found : null;
  const debounced = useDebounce(query?.text.trim() ?? null, SUGGEST_DEBOUNCE_MS);
  const typing = (query?.text.trim() ?? null) !== debounced;
  const tagged = mentionsInText(text, mentions);
  const limitReached = tagged.length >= CHAT_LIMITS.maxPatientsPerMessage;
  const suggestions = useChatPatientSuggestions(conversationId, debounced ?? "", query !== null && debounced !== null && !limitReached);
  const items = !typing && query ? (suggestions.data ?? []) : [];
  const active = Math.min(activeIndex, Math.max(items.length - 1, 0));

  // Puts the caret after a picked tag once React has written the new text.
  useLayoutEffect(() => {
    const at = pendingCaretRef.current;
    const input = getInput();
    if (at === null || !input) return;
    pendingCaretRef.current = null;
    input.setSelectionRange(at, at);
    setCaret(at);
  });

  const moveCaret = (at: number) => {
    pendingCaretRef.current = at;
  };

  const trackCaret = () => {
    const input = getInput();
    if (input) setCaret(input.selectionStart ?? 0);
  };

  const handleTextChange = (next: string, nextCaret: number) => {
    setText(next);
    setCaret(nextCaret);
    setActiveIndex(0);
    if (dismissedStart !== null && next[dismissedStart] !== "#") setDismissedStart(null);
  };

  const pick = (patient: ChatPatientSuggestionDto) => {
    if (!query || limitReached) return;
    const mention = { id: patient.id.toLowerCase(), name: safeMentionName(patient.name) };
    const inserted = `${mentionLabel(mention)} `;
    setText(text.slice(0, query.start) + inserted + text.slice(caret));
    if (!mentions.some((m) => m.id === mention.id)) setMentions([...mentions, mention]);
    moveCaret(query.start + inserted.length);
    setActiveIndex(0);
  };

  /** True when the key was the list's or a tag's to handle. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (query) {
      if (event.key === "Escape") {
        setDismissedStart(query.start);
        return true;
      }
      if (items.length > 0 && !limitReached) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((active + step + items.length) % items.length);
          return true;
        }
        if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
          pick(items[active]);
          return true;
        }
      }
    }
    const input = event.currentTarget;
    if (event.key === "Backspace" && input.selectionStart === input.selectionEnd) {
      const at = input.selectionStart;
      const tag = mentionEndingAt(text, at, mentions);
      if (tag) {
        setText(text.slice(0, tag.start) + text.slice(at));
        moveCaret(tag.start);
        return true;
      }
    }
    return false;
  };

  const status = (): PatientSuggestStatus => {
    if (limitReached) return "limit";
    if (items.length > 0) return "ready";
    if (typing || suggestions.isFetching) return "loading";
    return suggestions.isError ? "error" : "ready";
  };

  return {
    open: query !== null,
    items,
    activeIndex: active,
    setActiveIndex,
    status: status(),
    retry: () => void suggestions.refetch(),
    tagged,
    pick,
    handleKeyDown,
    handleTextChange,
    trackCaret,
  };
}
