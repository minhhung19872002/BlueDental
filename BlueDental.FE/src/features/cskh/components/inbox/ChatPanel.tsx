import { useState } from "react";
import { t, tRich } from "@/lib/i18n";
import { useConversationMessages, type ConversationDetail } from "../../api/inboxApi";
import { useHistorySync } from "../../hooks/useHistorySync";
import { useHoldActions } from "../../hooks/useHoldActions";
import { customerName, replyHoursLeft } from "../../inboxLook";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ZnsPreviewCard } from "./ZnsPreviewCard";
import { ZnsTemplateBar } from "./ZnsTemplateBar";

interface Props {
  conversation: ConversationDetail;
  meId: string | null;
  canHandle: boolean;
  connected: boolean;
  now: number;
}

/** The middle column: who and the hold, the chat, the ZNS row with its check, the reply box. */
export function ChatPanel({ conversation, meId, canHandle, connected, now }: Props) {
  const messages = useConversationMessages(conversation.id);
  const history = useHistorySync(conversation.id, connected);
  const hold = useHoldActions(conversation.id);
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(null);

  const heldByMe = conversation.holderId != null && conversation.holderId === meId;
  const canReply = canHandle && heldByMe;

  return (
    <section className="ibx-chat" aria-label={t("CSKH:Inbox:ChatLabel", customerName(conversation))}>
      <ChatHeader conversation={conversation} meId={meId} canHandle={canHandle} hold={hold} />
      <ChatMessages
        entries={messages.data}
        loading={messages.isLoading}
        customer={customerName(conversation)}
        history={history}
      />
      {canHandle && !heldByMe && (
        <p className="ibx-hint">
          {conversation.holderId
            ? t("CSKH:Inbox:HintHeldByOther", conversation.holderName ?? "")
            : tRich("CSKH:Inbox:HintClaim", <strong>{t("CSKH:Inbox:Claim")}</strong>)}
        </p>
      )}
      {pickedTemplate && (
        <ZnsPreviewCard
          // A new pick is a new check: the old card goes, the new one reads the customer again.
          key={pickedTemplate}
          conversationId={conversation.id}
          templateId={pickedTemplate}
          canSend={canReply}
          onClear={() => setPickedTemplate(null)}
        />
      )}
      {canHandle && <ZnsTemplateBar pickedId={pickedTemplate} disabled={!canReply} onPick={setPickedTemplate} />}
      <ChatComposer
        conversationId={conversation.id}
        canReply={canReply}
        windowOpen={conversation.canReplyFreely && replyHoursLeft(conversation.replyWindowEndsAt, now) > 0}
        hoursLeft={replyHoursLeft(conversation.replyWindowEndsAt, now)}
      />
    </section>
  );
}
