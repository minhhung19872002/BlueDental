import { useCallback, useEffect, useRef, useState } from "react";
import { nextNoticeOrder } from "@/lib/cornerNotices";
import { useConversationFetcher } from "../api/chatQueries";
import { CHAT_KIND, type ChatConversationDto, type ChatMessageDto } from "../types";
import { playChatTing } from "../utils/chatSound";
import { previewMessage } from "../utils/chatFormat";
import { isPageInBackground, showDesktopNotice } from "../utils/desktopNotify";

/** One toast: the newest message of a conversation (R-1165). */
export interface ChatAlert {
  conversationId: string;
  messageId: string;
  senderName: string;
  /** The sender, and the group's name for a group. */
  title: string;
  preview: string;
  unreadCount: number;
  /** Its place in the shared top-right column, newest first (R-1217). */
  order: number;
}

const MAX_ALERTS = 3;
/** A push about an old message (a rename, a member added) does not ring. */
const FRESH_MS = 10 * 60_000;

interface AlertOptions {
  /** The header's branch; like the badge, other branches stay quiet. */
  branchId: string | undefined;
  /** The thread on screen, if any. */
  viewingId: string | null;
  onOpen: (conversationId: string) => void;
}

function isAlertable(
  conversation: ChatConversationDto,
  message: ChatMessageDto | null,
  branchId: string | undefined,
): message is ChatMessageDto {
  return (
    message !== null &&
    !message.isMine &&
    !message.isRecalled &&
    message.editedAt === null &&
    Date.now() - Date.parse(message.sentAt) < FRESH_MS &&
    (branchId === undefined || conversation.clinicBranchId === branchId)
  );
}

function toAlert(conversation: ChatConversationDto, message: ChatMessageDto): ChatAlert {
  const isGroup = conversation.kind === CHAT_KIND.Group;
  return {
    conversationId: conversation.id,
    messageId: message.id,
    senderName: message.senderName,
    title: isGroup ? `${message.senderName} · ${conversation.title}` : message.senderName,
    preview: previewMessage(message),
    unreadCount: conversation.unreadCount,
    order: nextNoticeOrder(),
  };
}

/**
 * New-message toasts, BA 2026-11-06 ("thông báo để xem nhanh, 5s"): a
 * message from someone else shows top right with a ting, one toast per
 * conversation, at most three. While the app is not in front it is also a
 * Windows notification. The thread on screen gets neither; a conversation
 * read elsewhere drops its toast.
 */
export function useNewMessageAlerts({ branchId, viewingId, onOpen }: AlertOptions) {
  const fetchConversation = useConversationFetcher();
  const [alerts, setAlerts] = useState<ChatAlert[]>([]);
  const seenRef = useRef(new Set<string>());
  const latestRef = useRef({ branchId, viewingId, onOpen });
  useEffect(() => {
    latestRef.current = { branchId, viewingId, onOpen };
  });

  const dismiss = useCallback((conversationId: string) => {
    setAlerts((list) => list.filter((alert) => alert.conversationId !== conversationId));
  }, []);

  useEffect(() => {
    if (viewingId) dismiss(viewingId);
  }, [viewingId, dismiss]);

  const handleChanged = useCallback(
    async (conversationId: string) => {
      let conversation: ChatConversationDto;
      try {
        conversation = await fetchConversation(conversationId);
      } catch (error: unknown) {
        // Left, removed, or out of reach: nothing to show for it.
        console.warn("Chat toast skipped:", error);
        dismiss(conversationId);
        return;
      }
      if (conversation.unreadCount === 0) {
        dismiss(conversationId);
        return;
      }
      const message = conversation.lastMessage;
      const { branchId: shownBranch, viewingId: onScreen } = latestRef.current;
      if (!isAlertable(conversation, message, shownBranch) || seenRef.current.has(message.id)) return;
      seenRef.current.add(message.id);

      const background = isPageInBackground();
      if (onScreen === conversationId && !background) return;
      const alert = toAlert(conversation, message);
      void playChatTing();
      if (background) {
        showDesktopNotice({
          tag: conversationId,
          title: alert.title,
          body: alert.preview,
          onClick: () => latestRef.current.onOpen(conversationId),
        });
      }
      if (onScreen !== conversationId) {
        setAlerts((list) =>
          [alert, ...list.filter((item) => item.conversationId !== conversationId)].slice(0, MAX_ALERTS),
        );
      }
    },
    [fetchConversation, dismiss],
  );

  return { alerts, handleChanged, dismiss };
}
