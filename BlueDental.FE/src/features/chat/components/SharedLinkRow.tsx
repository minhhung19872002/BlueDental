import React from "react";
import { Link2 } from "lucide-react";
import type { ChatSharedLinkDto } from "../types";
import { formatMessageTime } from "../utils/chatFormat";
import { linkKey, type SharedPicking } from "../utils/chatShared";
import { SharedRow } from "./SharedRow";

interface SharedLinkRowProps {
  link: ChatSharedLinkDto;
  picking: SharedPicking;
  onJump: (messageId: string) => void;
}

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** A link written in the conversation; opens in a new tab without telling the site where it came from. */
export const SharedLinkRow = React.memo(function SharedLinkRow({ link, picking, onJump }: SharedLinkRowProps) {
  const key = linkKey(link);
  return (
    <SharedRow
      selecting={picking.selecting}
      selected={picking.selected.has(key)}
      onToggle={() => picking.toggle(key, { kind: "link", item: link })}
      onJump={() => onJump(link.messageId)}
      open={{ href: link.url }}
    >
      <Link2 size={20} className="chat-shared-row-icon" aria-hidden />
      <span className="chat-shared-row-text">
        <span className="chat-shared-row-title">{hostOf(link.url)}</span>
        <span className="chat-shared-row-url">{link.url}</span>
        <span className="chat-shared-row-meta">
          {link.senderName} · {formatMessageTime(link.sentAt)}
        </span>
      </span>
    </SharedRow>
  );
});
