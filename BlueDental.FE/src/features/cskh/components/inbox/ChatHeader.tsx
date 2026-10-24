import { useState } from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import type { ConversationDetail } from "../../api/inboxApi";
import type { HoldActions } from "../../hooks/useHoldActions";
import { customerName, needsContact, stamp } from "../../inboxLook";
import { RequestInfoButton } from "./RequestInfoButton";
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
 * "Nhả hội thoại"; held by a colleague → who. No phone yet → "Chưa có SĐT",
 * when the card asking for it went, and "Xin SĐT" for the holder (R-1028).
 */
export function ChatHeader({ conversation, meId, canHandle, hold }: Props) {
  const [transferOpen, setTransferOpen] = useState(false);
  const heldByMe = conversation.holderId != null && conversation.holderId === meId;
  const phone = conversation.patientPhone ?? conversation.sharedPhone;
  const noPhone = needsContact(conversation);

  return (
    <header className="ibx-chat-head">
      <div className="ibx-chat-who">
        <div className="ibx-chat-title">
          <h3 className="ibx-chat-name">{customerName(conversation)}</h3>
          {noPhone && <span className="ibx-pill ibx-pill--nophone">{t("CSKH:Inbox:NoPhoneYet")}</span>}
        </div>
        <span className="ibx-chat-sub">
          {[
            phone,
            conversation.lastCustomerMessageAt && t("CSKH:Inbox:CustomerWrote", stamp(conversation.lastCustomerMessageAt)),
            noPhone && conversation.infoRequestedAt && t("CSKH:Inbox:InfoRequestedAt", stamp(conversation.infoRequestedAt)),
          ]
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
            {noPhone && <RequestInfoButton conversationId={conversation.id} disabled={!conversation.canReplyFreely} />}
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
