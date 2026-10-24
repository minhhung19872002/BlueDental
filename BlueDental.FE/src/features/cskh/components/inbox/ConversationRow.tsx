import { memo } from "react";
import { t } from "@/lib/i18n";
import { CONVERSATION_STATUS, type ConversationSummary } from "../../api/inboxApi";
import { customerName, listTime, needsContact, previewText, waitTone } from "../../inboxLook";
import { InboxAvatar } from "./InboxAvatar";
import { StatusPill } from "./StatusPill";

interface Props {
  conversation: ConversationSummary;
  selected: boolean;
  meId: string | null;
  now: number;
  onSelect: (id: string) => void;
}

/** One customer of the list: name, time, Chưa trả lời / Đã chăm sóc, who holds it; the wait colours the edge. */
export const ConversationRow = memo(function ConversationRow({ conversation, selected, meId, now, onSelect }: Props) {
  const tone = waitTone(conversation, now);
  const name = customerName(conversation);
  const className = [
    "ibx-row",
    selected && "ibx-row--selected",
    tone && `ibx-row--${tone}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <button
        type="button"
        className={className}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(conversation.id)}
      >
        <InboxAvatar name={name} avatarUrl={conversation.avatarUrl} />
        <span className="ibx-row-body">
          <span className="ibx-row-top">
            <span className="ibx-row-name">{name}</span>
            <span className={["ibx-row-time", tone && `ibx-row-time--${tone}`].filter(Boolean).join(" ")}>
              {listTime(conversation.status === CONVERSATION_STATUS.Unreplied
                ? conversation.lastCustomerMessageAt
                : conversation.lastMessageAt, now)}
            </span>
          </span>
          {conversation.lastMessagePreview && (
            <span className="ibx-row-preview">{previewText(conversation.lastMessagePreview, conversation.lastMessageDirection)}</span>
          )}
          <span className="ibx-row-pills">
            <StatusPill status={conversation.status} />
            {conversation.holderId && (
              <span className="ibx-pill ibx-pill--holder">
                {conversation.holderId === meId
                  ? t("CSKH:Inbox:HeldByYou")
                  : t("CSKH:Inbox:HeldBy", conversation.holderName ?? "")}
              </span>
            )}
            {needsContact(conversation) && <span className="ibx-pill ibx-pill--nophone">{t("CSKH:Inbox:NoPhoneYet")}</span>}
          </span>
        </span>
      </button>
    </li>
  );
});
