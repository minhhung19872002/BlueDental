import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { Input } from "antd";
import { NOTE_BULLET, bulletNote } from "./stageNoteLines";

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  maxLength: number;
  status?: "error";
  /** Blanked by FloatingLabel while its label rests inside the field. */
  placeholder?: string;
}

/** Where the caret goes once the value an Enter wrote is on screen. */
interface PendingCaret {
  box: HTMLTextAreaElement;
  value: string;
  at: number;
}

/** Whether an IME is still composing — rewriting the value then breaks it. */
function composing(event: Event): boolean {
  return "isComposing" in event && event.isComposing === true;
}

/**
 * The Nội dung điều trị box, written as a bulleted list (BA, 2026-10-19,
 * R-983): the first thing typed into an empty box starts a "- " line, and
 * Enter opens the next one. Shift+Enter still breaks a line without a bullet.
 * Ticked công đoạn come in bulleted through syncStageContent.
 */
export function StageNoteInput({ value, onChange, rows, maxLength, status, placeholder }: Props) {
  const pendingCaret = useRef<PendingCaret | null>(null);

  // React leaves the caret at the end when it writes a new value. Put it back
  // after the bullet just opened in the same commit — a frame later is too
  // late, the next keys have already landed at the end.
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending || pending.value !== value) return;
    pendingCaret.current = null;
    pending.box.setSelectionRange(pending.at, pending.at);
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const typed = event.target.value;
    // Empty when what was typed is a bare "-": that is left to become the
    // bullet itself rather than vanish.
    const bulleted = value === "" && !composing(event.nativeEvent) ? bulletNote(typed) : "";
    onChange(bulleted ? bulleted.slice(0, maxLength) : typed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || composing(event.nativeEvent)) return;

    const box = event.currentTarget;
    const { selectionStart, selectionEnd } = box;
    const next = `${value.slice(0, selectionStart)}\n${NOTE_BULLET}${value.slice(selectionEnd)}`;
    if (next.length > maxLength) return;

    event.preventDefault();
    pendingCaret.current = { box, value: next, at: selectionStart + 1 + NOTE_BULLET.length };
    onChange(next);
  };

  return (
    <Input.TextArea
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      status={status}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
