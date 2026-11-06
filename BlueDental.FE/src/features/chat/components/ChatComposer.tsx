import React, { useRef } from "react";
import { Button, Input, Spin, Tag } from "antd";
import { Paperclip, SendHorizontal, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useChatComposer } from "../hooks/useChatComposer";
import { CHAT_LIMITS, type ChatMessageDto } from "../types";
import { CHAT_FILE_ACCEPT } from "../utils/chatFormat";

interface ChatComposerProps {
  conversationId: string;
  editing: ChatMessageDto | null;
  onEditDone: () => void;
}

/**
 * Text box, files and "Gửi". Enter sends, Shift+Enter breaks the line; files
 * can be picked or pasted and upload before the message is sent.
 */
export const ChatComposer: React.FC<ChatComposerProps> = ({ conversationId, editing, onEditDone }) => {
  const composer = useChatComposer(conversationId, editing, onEditDone);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    composer.submit();
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
          <button type="button" className="chat-icon-button" aria-label={t("Chat:CancelEdit")} onClick={onEditDone}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      {composer.files.length > 0 && (
        <div className="chat-composer-files">
          {composer.files.map((file) => (
            <Tag
              key={file.key}
              closable={!!file.attachmentId}
              closeIcon={<X size={12} aria-label={t("Chat:RemoveAttachment", file.name)} />}
              onClose={() => composer.removeFile(file.key)}
              icon={file.attachmentId ? undefined : <Spin size="small" />}
            >
              {file.name}
            </Tag>
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
        <Input.TextArea
          className="chat-composer-input"
          value={composer.text}
          onChange={(event) => composer.setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t("Chat:Placeholder")}
          aria-label={t("Chat:Placeholder")}
          autoSize={{ minRows: 1, maxRows: 5 }}
          maxLength={CHAT_LIMITS.maxMessageLength}
          autoFocus
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
