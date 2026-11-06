import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CHAT_LIMITS } from "../types";
import { chatApi } from "./chatApi";

/**
 * Everything chat-related sits under one root key, so a "ChatChanged" push or
 * a write refetches the whole open chat at once. The branch the header shows
 * is part of each key: the server scopes the list and contacts to it.
 */
export const chatKeys = {
  all: ["chat"] as const,
  unread: (branchId: string | undefined) => [...chatKeys.all, "unread", branchId ?? "all"] as const,
  conversations: (branchId: string | undefined, filter: string) =>
    [...chatKeys.all, "conversations", branchId ?? "all", filter] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (id: string) => [...chatKeys.all, "messages", id] as const,
  contacts: (branchId: string | undefined, filter: string) =>
    [...chatKeys.all, "contacts", branchId ?? "all", filter] as const,
  /** Its own root: a file never changes, so chat refetches leave it alone. */
  attachment: (attachmentId: string) => ["chat-file", attachmentId] as const,
};

/** A safety net for a missed push; the hub is the usual trigger. */
const UNREAD_POLL_MS = 60_000;

export function useChatUnreadCount(branchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.unread(branchId),
    queryFn: chatApi.unreadCount,
    enabled,
    refetchInterval: UNREAD_POLL_MS,
  });
}

export function useChatConversations(branchId: string | undefined, filter: string) {
  return useQuery({
    queryKey: chatKeys.conversations(branchId, filter),
    queryFn: () => chatApi.conversations(filter),
    placeholderData: keepPreviousData,
  });
}

export function useChatConversation(id: string) {
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: () => chatApi.conversation(id),
  });
}

/** Pages come newest first; each older page starts before the last one's oldest message. */
export function useChatMessages(id: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ pageParam }) => chatApi.messages(id, pageParam, CHAT_LIMITS.messagePageSize),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.items.at(-1)?.id : undefined),
  });
}

export function useChatContacts(branchId: string | undefined, filter: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.contacts(branchId, filter),
    queryFn: () => chatApi.contacts(filter),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * An attachment's bytes as a blob, for an image shown inline. Kept while the
 * message is on screen; the object URL is made and released by the caller.
 */
export function useChatAttachmentBlob(messageId: string, attachmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.attachment(attachmentId),
    queryFn: () => chatApi.attachment(messageId, attachmentId),
    enabled,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}
