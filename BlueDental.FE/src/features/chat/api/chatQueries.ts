import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  CHAT_LIMITS,
  type ChatMessageDto,
  type ChatMessagePageDto,
  type ChatSharedFilter,
  type ChatSharedKind,
} from "../types";
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
  revisions: (messageId: string) => [...chatKeys.all, "revisions", messageId] as const,
  contacts: (branchId: string | undefined, filter: string) =>
    [...chatKeys.all, "contacts", branchId ?? "all", filter] as const,
  /** Its own root too: a push that refetches the chat must not rerun every search. */
  search: (id: string, text: string) => ["chat-search", id, text] as const,
  /** # suggestions (R-1161): their own root, so chat pushes do not rerun them. */
  patientSuggestions: (id: string, text: string) => ["chat-patients", id, text] as const,
  /**
   * Kho lưu trữ (R-1160) has its own root: a push for every new message must
   * not rescan the links. The panel refetches each time it is opened.
   */
  sharedFiles: (id: string, kind: ChatSharedKind, filter: ChatSharedFilter) =>
    ["chat-shared", id, "files", kind, filter] as const,
  sharedLinks: (id: string, filter: ChatSharedFilter) => ["chat-shared", id, "links", filter] as const,
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

/** Searched on the server, which decrypts the messages; empty text searches nothing. */
export function useChatMessageSearch(id: string, text: string) {
  return useQuery({
    queryKey: chatKeys.search(id, text),
    queryFn: () => chatApi.searchMessages(id, text),
    enabled: text.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * The # list while typing (R-1161); empty text lists today's patients. Kept
 * a short while, so going back over a name does not ask again.
 */
export function useChatPatientSuggestions(id: string, text: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.patientSuggestions(id, text),
    queryFn: () => chatApi.patientSuggestions(id, text),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Pictures or other files of one conversation, a page at a time, newest first (R-1160). */
export function useChatSharedFiles(id: string, kind: ChatSharedKind, filter: ChatSharedFilter) {
  const pageSize = CHAT_LIMITS.sharedFilePageSize;
  return useInfiniteQuery({
    queryKey: chatKeys.sharedFiles(id, kind, filter),
    queryFn: ({ pageParam }) => chatApi.sharedFiles(id, kind, filter, pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length * pageSize : undefined),
  });
}

/** The links written in one conversation, found by the server in the decrypted text (R-1160). */
export function useChatSharedLinks(id: string, filter: ChatSharedFilter) {
  return useQuery({
    queryKey: chatKeys.sharedLinks(id, filter),
    queryFn: () => chatApi.sharedLinks(id, filter),
    staleTime: 30_000,
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

/** Earlier wordings of one message (R-1159); fetched only while the history is open. */
export function useChatMessageRevisions(messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.revisions(messageId),
    queryFn: () => chatApi.revisions(messageId),
    enabled,
  });
}

/**
 * Reloads a thread and hands back one message as the server now has it —
 * for an edit that lost to an edit made elsewhere (R-1159). Undefined when
 * it is no longer on the loaded pages.
 */
export function useReloadChatMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return async (messageId: string): Promise<ChatMessageDto | undefined> => {
    const key = chatKeys.messages(conversationId);
    await queryClient.refetchQueries({ queryKey: key, exact: true });
    const data = queryClient.getQueryData<InfiniteData<ChatMessagePageDto>>(key);
    return data?.pages.flatMap((page) => page.items).find((message) => message.id === messageId);
  };
}
