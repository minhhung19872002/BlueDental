import { Spin } from "antd";
import { EmptyState } from "@/components/EmptyState";
import { t } from "@/lib/i18n";
import { useConversation } from "../../api/inboxApi";
import { ChatPanel } from "./ChatPanel";
import { CustomerPanel } from "./CustomerPanel";

interface Props {
  id: string;
  meId: string | null;
  canHandle: boolean;
  connected: boolean;
  now: number;
}

/** The open conversation: the chat in the middle, the customer on the right. */
export function ConversationView({ id, meId, canHandle, connected, now }: Props) {
  const conversation = useConversation(id);

  if (conversation.isLoading) {
    return (
      <div className="ibx-pane-center">
        <Spin />
      </div>
    );
  }

  if (!conversation.data) {
    return (
      <div className="ibx-pane-center">
        <EmptyState icon="💬" title={t("CSKH:Inbox:NotFound")} />
      </div>
    );
  }

  return (
    <>
      <ChatPanel conversation={conversation.data} meId={meId} canHandle={canHandle} connected={connected} now={now} />
      <CustomerPanel conversation={conversation.data} canHandle={canHandle} />
    </>
  );
}
