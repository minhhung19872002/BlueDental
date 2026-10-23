import { useState } from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import type { ConversationDetail } from "../../api/inboxApi";
import type { HoldActions } from "../../hooks/useHoldActions";
import { customerName, stamp } from "../../inboxLook";
import { StatusPill } from "./StatusPill";
import { TransferDialog } from "./TransferDialog";

interface Props {
  conversation: ConversationDetail;
  meId: string | null;
  canHandle: boolean;
  hold: HoldActions;
}

/**
 * Name, phone, when the customer wrote, the status and the hold (BA P2210):
 * free → "Nhận xử lý"; held by you → "Bạn đang xử lý", "Chuyển cho…",
 * "Nhả hội thoại"; held by a colleague → who.
 */
export function ChatHeader({ conversation, meId, canHandle, hold }: Props) {
  const [transferOpen, setTransferOpen] = useState(false);
  const heldByMe = conversation.holderId != null && conversation.holderId === meId;
  const phone = conversation.patientPhone ?? conversation.sharedPhone;

  return (
    <header className="ibx-chat-head">
      <div className="ibx-chat-who">
        <h3 className="ibx-chat-name">{customerName(conversation)}</h3>
        <span className="ibx-chat-sub">
          {[phone, conversation.lastCustomerMessageAt && t("CSKH:Inbox:CustomerWrote", stamp(conversation.lastCustomerMessageAt))]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="ibx-chat-actions">
        <StatusPill status={conversation.status} />
        {heldByMe && <span className="ibx-pill ibx-pill--mine">{t("CSKH:Inbox:HeldByYouLong")}</span>}
        {conversation.holderId && !heldByMe && (
          <span className="ibx-pill ibx-pill--holder">{t("CSKH:Inbox:HeldBy", conversation.holderName ?? "")}</span>
        )}
        {canHandle && !conversation.holderId && (
          <Button type="primary" loading={hold.claiming} disabled={hold.claiming} onClick={hold.claim}>
            {t("CSKH:Inbox:Claim")}
          </Button>
        )}
        {canHandle && heldByMe && (
          <>
            <Button onClick={() => setTransferOpen(true)}>{t("CSKH:Inbox:Transfer")}</Button>
            <Button loading={hold.releasing} disabled={hold.releasing} onClick={hold.release}>
              {t("CSKH:Inbox:Release")}
            </Button>
          </>
        )}
      </div>
      <TransferDialog
        open={transferOpen}
        pending={hold.transferring}
        onClose={() => setTransferOpen(false)}
        onTransfer={(userId, name) => hold.transfer(userId, name, () => setTransferOpen(false))}
      />
    </header>
  );
}
