import { t } from "@/lib/i18n";
import { CONVERSATION_STATUS, type ConversationStatus } from "../../api/inboxApi";

const STATUS_LOOK: Record<ConversationStatus, { className: string; label: string }> = {
  [CONVERSATION_STATUS.Unreplied]: { className: "ibx-pill--unreplied", label: "CSKH:Inbox:Status:Unreplied" },
  [CONVERSATION_STATUS.Cared]: { className: "ibx-pill--cared", label: "CSKH:Inbox:Status:Cared" },
};

/** "Chưa trả lời" / "Đã chăm sóc" — the two states BA P2210 gives a conversation. */
export function StatusPill({ status }: { status: ConversationStatus }) {
  const look = STATUS_LOOK[status];
  return <span className={`ibx-pill ${look.className}`}>{t(look.label)}</span>;
}
