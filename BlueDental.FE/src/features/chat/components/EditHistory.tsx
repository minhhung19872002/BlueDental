import React, { useState } from "react";
import { Popover, Tooltip } from "antd";
import { t } from "@/lib/i18n";
import { useChatMessageRevisions } from "../api/chatQueries";
import { formatMessageTime } from "../utils/chatFormat";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";
import { MessageText } from "./MessageText";
import { PatientCards } from "./PatientCard";

interface EditHistoryProps {
  messageId: string;
  editedAt: string;
}

/**
 * The "đã chỉnh sửa" mark under an edited message (R-1159). Hovering tells
 * when it was last edited; clicking lists the earlier wordings, newest first,
 * loaded only then. Every member of the conversation may read them.
 */
export const EditHistory: React.FC<EditHistoryProps> = ({ messageId, editedAt }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useChatMessageRevisions(messageId, open);

  const content = (
    <div className="chat-edit-history" aria-live="polite">
      {isLoading && <ChatSpinner size="small" />}
      {isError && <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />}
      {data && data.length === 0 && <ChatStatus text={t("Chat:NoEditHistory")} />}
      {data && data.length > 0 && (
        <ol className="chat-edit-history-list">
          {data.map((revision) => (
            <li key={revision.editedAt} className="chat-edit-history-item">
              <span className="chat-edit-history-time">
                {t("Chat:ReplacedAt", formatMessageTime(revision.editedAt))}
              </span>
              {/* Text, never HTML: React escapes it. */}
              {revision.content ? (
                <MessageText className="chat-edit-history-text" text={revision.content} />
              ) : (
                <p className="chat-edit-history-text">{t("Chat:NoText")}</p>
              )}
              {revision.patients.length > 0 && <PatientCards patients={revision.patients} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="top"
      title={t("Chat:EditHistory")}
      content={content}
      destroyOnHidden
    >
      <Tooltip title={t("Chat:EditedAt", formatMessageTime(editedAt))}>
        <button type="button" className="chat-edited-mark" aria-haspopup="dialog" aria-expanded={open}>
          {t("Chat:Edited")}
        </button>
      </Tooltip>
    </Popover>
  );
};
