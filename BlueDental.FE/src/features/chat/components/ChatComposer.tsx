import React, { useRef } from "react";
import { Button } from "antd";
import { Paperclip, SendHorizontal, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useChatComposer } from "../hooks/useChatComposer";
import type { ChatMessageDto } from "../types";
import { CHAT_FILE_ACCEPT } from "../utils/chatFormat";
import { ComposerTextBox } from "./ComposerTextBox";
import { PendingFileChip } from "./PendingFileChip";

interface ChatComposerProps {
  conversationId: string;
  editing: ChatMessageDto | null;
  /** A message to edit, a fresh copy of it, or null when editing ends. */
  onEditingChange: (message: ChatMessageDto | null) => void;
  /** ↑ in an empty box: edit the caller's newest message still in its window. */
  onEditLast: () => void;
}

/**
 * Text box, files and "Gửi". Enter sends (or saves an edit), Shift+Enter
 * breaks the line, Esc drops an edit, # tags a patient (R-1161). Files can be picked or pasted and
 * upload before sending; an edit is text only, so both are locked while
 * editing and the draft's files wait out of sight.
 */
export const ChatComposer: React.FC<ChatComposerProps> = ({ conversationId, editing, onEditingChange, onEditLast }) => {
  const composer = useChatComposer(conversationId, editing, onEditingChange);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      composer.cancelEdit();
    } else if (event.key === "ArrowUp" && !editing && composer.text.length === 0) {
      event.preventDefault();
      onEditLast();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composer.submit();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (editing || event.clipboardData.files.length === 0) return;
    event.preventDefault();
    composer.addFiles(Array.from(event.clipboardData.files));
  };

  const handleFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    composer.addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <div className="chat-composer">
      {editing && (
        <div className="chat-composer-editing">
          <span>{t("Chat:Editing")}</span>
          <button
            type="button"
            className="chat-icon-button"
            aria-label={t("Chat:CancelEdit")}
            title={t("Chat:CancelEdit")}
            onClick={composer.cancelEdit}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      {!editing && composer.files.length > 0 && (
        <div className="chat-composer-files">
          {composer.files.map((file) => (
            <PendingFileChip key={file.key} file={file} onRemove={composer.removeFile} />
          ))}
        </div>
      )}
      <div className="chat-composer-row">
        {!editing && (
          <>
            <button
              type="button"
              className="chat-icon-button"
              aria-label={t("Chat:Attach")}
              title={t("Chat:Attach")}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} aria-hidden />
            </button>
            <input ref={fileInputRef} type="file" multiple hidden accept={CHAT_FILE_ACCEPT} onChange={handleFilesPicked} />
          </>
        )}
        <ComposerTextBox
          conversationId={conversationId}
          text={composer.text}
          onTextChange={composer.setText}
          mentions={composer.mentions}
          onMentionsChange={composer.setMentions}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <Button
          type="primary"
          icon={<SendHorizontal size={16} aria-hidden />}
          loading={composer.busy}
          disabled={!composer.canSubmit}
          onClick={composer.submit}
        >
          {editing ? t("Chat:Save") : t("Chat:Send")}
        </Button>
      </div>
    </div>
  );
};
