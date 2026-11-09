import React, { useState } from "react";
import { t } from "@/lib/i18n";
import type { ChatMemberDto, ChatMessageDto } from "../types";
import { initialsOf } from "../utils/chatFormat";
import { formatSeenTime, type ChatReader } from "../utils/chatSeen";
import { SeenDialog } from "./SeenDialog";

/** More readers than this fold into "+n". */
const MAX_AVATARS = 5;

interface MessageSeenProps {
  message: ChatMessageDto;
  /** The members whose read mark rests on this message, latest first. */
  readers: readonly ChatReader[];
  /** The bottom message of the thread. */
  isNewest: boolean;
  isGroup: boolean;
  members: readonly ChatMemberDto[];
}

/**
 * "Đã xem" under a message (R-1178).
 *
 * - Two-person chat: only under the bottom message when it is the viewer's —
 *   "Đã xem 14:32" once the other person has read it, "Đã gửi" before.
 * - Group: the avatars of whoever stopped reading at this message; clicking
 *   them lists who has and has not seen it. The viewer's bottom message that
 *   nobody has read yet says "Đã gửi".
 */
export const MessageSeen: React.FC<MessageSeenProps> = ({ message, readers, isNewest, isGroup, members }) => {
  const [open, setOpen] = useState(false);
  // A recalled or edited message keeps its state: it was read as it was then.
  const ownNewest = isNewest && message.isMine;

  if (!isGroup) {
    if (!ownNewest) return null;
    const text = readers.length > 0 ? t("Chat:SeenAt", formatSeenTime(readers[0].readAt)) : t("Chat:Sent");
    return <span className="chat-seen chat-seen-text">{text}</span>;
  }

  if (readers.length === 0) {
    return ownNewest ? <span className="chat-seen chat-seen-text">{t("Chat:Sent")}</span> : null;
  }

  const shown = readers.slice(0, MAX_AVATARS);
  const hidden = readers.length - shown.length;
  const label = t("Chat:SeenBy", readers.map((reader) => reader.fullName).join(", "));

  return (
    <div className="chat-seen">
      <button type="button" className="chat-seen-button" aria-label={label} title={label} onClick={() => setOpen(true)}>
        {shown.map((reader) => (
          <span key={reader.userId} className="chat-avatar chat-seen-avatar" aria-hidden>
            {initialsOf(reader.fullName)}
          </span>
        ))}
        {hidden > 0 && (
          <span className="chat-avatar chat-seen-avatar chat-seen-more" aria-hidden>
            +{hidden}
          </span>
        )}
      </button>
      {open && <SeenDialog message={message} readers={readers} members={members} onClose={() => setOpen(false)} />}
    </div>
  );
};
