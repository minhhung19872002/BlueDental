import React, { useId, useRef } from "react";
import { Input } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { t } from "@/lib/i18n";
import { usePatientMentions } from "../hooks/usePatientMentions";
import { CHAT_LIMITS } from "../types";
import { splitDraft, type ChatMention } from "../utils/chatPatientTokens";
import { PatientSuggestions, suggestionOptionId } from "./PatientSuggestions";

interface ComposerTextBoxProps {
  conversationId: string;
  text: string;
  onTextChange: (text: string) => void;
  mentions: ChatMention[];
  onMentionsChange: (mentions: ChatMention[]) => void;
  /** Keys the # list and the tags leave alone (send, edit, Esc). */
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * The composer's text box with # tags (R-1161). A layer under the
 * transparent box repeats the text and shades each picked `#Tên` like a chip,
 * so the box itself stays a plain text area. Names are text, never HTML.
 */
export const ComposerTextBox: React.FC<ComposerTextBoxProps> = ({
  conversationId,
  text,
  onTextChange,
  mentions,
  onMentionsChange,
  onKeyDown,
  onPaste,
}) => {
  const boxRef = useRef<TextAreaRef>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const getInput = () => boxRef.current?.resizableTextArea?.textArea ?? null;
  const tags = usePatientMentions({
    conversationId,
    text,
    setText: onTextChange,
    mentions,
    setMentions: onMentionsChange,
    getInput,
  });
  const listShown = tags.open && tags.items.length > 0 && tags.status === "ready";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (tags.handleKeyDown(event)) {
      event.preventDefault();
      return;
    }
    onKeyDown(event);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    tags.handleTextChange(event.target.value, event.target.selectionStart ?? event.target.value.length);

  // The shading layer scrolls with the text.
  const handleScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop;
  };

  return (
    <div className="chat-composer-box">
      {tags.open && (
        <PatientSuggestions
          id={listId}
          items={tags.items}
          activeIndex={tags.activeIndex}
          status={tags.status}
          onRetry={tags.retry}
          onHover={tags.setActiveIndex}
          onPick={tags.pick}
        />
      )}
      <div ref={backdropRef} className="chat-composer-backdrop" aria-hidden>
        {splitDraft(text, mentions).map((piece, index) =>
          piece.tag ? (
            <mark key={index} className="chat-composer-tag">
              {piece.text}
            </mark>
          ) : (
            <span key={index}>{piece.text}</span>
          ),
        )}
        {/* A trailing line break needs a character after it to take up its line. */}
        {"​"}
      </div>
      <Input.TextArea
        ref={boxRef}
        className="chat-composer-input"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={tags.trackCaret}
        onClick={tags.trackCaret}
        onSelect={tags.trackCaret}
        onScroll={handleScroll}
        onPaste={onPaste}
        placeholder={t("Chat:Placeholder")}
        aria-label={t("Chat:Placeholder")}
        aria-autocomplete="list"
        aria-controls={listShown ? listId : undefined}
        aria-activedescendant={listShown ? suggestionOptionId(listId, tags.activeIndex) : undefined}
        autoSize={{ minRows: 1, maxRows: 5 }}
        maxLength={CHAT_LIMITS.maxMessageLength}
        autoFocus
      />
    </div>
  );
};
