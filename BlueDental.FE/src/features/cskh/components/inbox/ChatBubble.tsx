import { memo } from "react";
import { t } from "@/lib/i18n";
import { CHAT_DIRECTION, CHAT_KIND, CHAT_SOURCE, ZNS_STATE, type ChatEntry, type ChatKind, type ZnsState } from "../../api/inboxApi";
import { OA_AUTO_LABEL, stamp } from "../../inboxLook";

const KIND_LABEL: Partial<Record<ChatKind, string>> = {
  [CHAT_KIND.Image]: "CSKH:Inbox:Kind:Image",
  [CHAT_KIND.Sticker]: "CSKH:Inbox:Kind:Sticker",
  [CHAT_KIND.File]: "CSKH:Inbox:Kind:File",
  [CHAT_KIND.Link]: "CSKH:Inbox:Kind:Link",
  [CHAT_KIND.Audio]: "CSKH:Inbox:Kind:Audio",
  [CHAT_KIND.Video]: "CSKH:Inbox:Kind:Video",
  [CHAT_KIND.Location]: "CSKH:Inbox:Kind:Location",
  [CHAT_KIND.Other]: "CSKH:Inbox:Kind:Other",
};

const ZNS_STATE_LABEL: Record<ZnsState, string> = {
  [ZNS_STATE.Sent]: "CSKH:Inbox:Zns:Sent",
  [ZNS_STATE.Delivered]: "CSKH:Inbox:Zns:Delivered",
  [ZNS_STATE.Failed]: "CSKH:Inbox:Zns:Failed",
};

/** Links Zalo hands over are shown only as plain web addresses; anything else stays text. */
function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function Attachment({ entry }: { entry: ChatEntry }) {
  const url = safeUrl(entry.attachmentUrl);
  const label = entry.kind === CHAT_KIND.Other && entry.direction === CHAT_DIRECTION.Outbound
    ? OA_AUTO_LABEL
    : KIND_LABEL[entry.kind];
  if (url && (entry.kind === CHAT_KIND.Image || entry.kind === CHAT_KIND.Sticker)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="ibx-bubble-media">
        <img src={url} alt={t(label ?? "CSKH:Inbox:Kind:Image")} referrerPolicy="no-referrer" loading="lazy" />
      </a>
    );
  }

  // The words say what the message is; the kind's label is only for one without any.
  if (!label || (entry.text && !url)) return null;
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ibx-bubble-file">
      {t(label)}
    </a>
  ) : (
    <span className="ibx-bubble-file">{t(label)}</span>
  );
}

/** One message: the customer's on the left; the OA's on the right with who sent it; a ZNS with its template and how far it got. */
export const ChatBubble = memo(function ChatBubble({ entry, customer }: { entry: ChatEntry; customer: string }) {
  const outbound = entry.direction === CHAT_DIRECTION.Outbound;
  const zns = entry.source === CHAT_SOURCE.Zns;
  const by = outbound ? entry.senderName && t("CSKH:Inbox:SentBy", entry.senderName) : customer;
  const className = [
    "ibx-bubble",
    outbound ? "ibx-bubble--out" : "ibx-bubble--in",
    zns && "ibx-bubble--zns",
    entry.znsState === ZNS_STATE.Failed && "ibx-bubble--failed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={outbound ? "ibx-msg ibx-msg--out" : "ibx-msg"}>
      <div className={className}>
        {zns && <span className="ibx-bubble-tag">{t("CSKH:Inbox:Zns:Tag", entry.templateName ?? "")}</span>}
        <Attachment entry={entry} />
        {entry.text && <p className="ibx-bubble-text">{entry.text}</p>}
      </div>
      <span className="ibx-msg-meta">
        {[by, stamp(entry.sentAt), entry.znsState && t(ZNS_STATE_LABEL[entry.znsState])].filter(Boolean).join(" · ")}
      </span>
    </li>
  );
});
