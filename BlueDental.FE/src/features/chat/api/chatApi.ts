import { api } from "@/lib/axios";
import type {
  ChatAttachmentDto,
  ChatContactDto,
  ChatConversationDto,
  ChatMessageDto,
  ChatMessagePageDto,
  ChatUnreadCountDto,
  CreateGroupChatInput,
  SendChatMessageInput,
} from "../types";

const BASE = "/v1/app/chat";

/** Plain HTTP calls; only the hooks in this folder use them. */
export const chatApi = {
  contacts: (filter: string) =>
    api.get<ChatContactDto[]>(`${BASE}/contacts`, { params: { filter: filter || undefined } }).then((r) => r.data),
  unreadCount: () => api.get<ChatUnreadCountDto>(`${BASE}/unread-count`).then((r) => r.data),
  conversations: (filter: string) =>
    api
      .get<ChatConversationDto[]>(`${BASE}/conversations`, { params: { filter: filter || undefined } })
      .then((r) => r.data),
  conversation: (id: string) => api.get<ChatConversationDto>(`${BASE}/conversations/${id}`).then((r) => r.data),
  messages: (id: string, beforeId: string | undefined, maxResultCount: number) =>
    api
      .get<ChatMessagePageDto>(`${BASE}/conversations/${id}/messages`, { params: { beforeId, maxResultCount } })
      .then((r) => r.data),
  openDirect: (userId: string) =>
    api.post<ChatConversationDto>(`${BASE}/conversations/direct`, { userId }).then((r) => r.data),
  createGroup: (input: CreateGroupChatInput) =>
    api.post<ChatConversationDto>(`${BASE}/conversations/group`, input).then((r) => r.data),
  rename: (id: string, name: string) =>
    api.put<ChatConversationDto>(`${BASE}/conversations/${id}/name`, { name }).then((r) => r.data),
  addMembers: (id: string, userIds: string[]) =>
    api.post<ChatConversationDto>(`${BASE}/conversations/${id}/members`, { userIds }).then((r) => r.data),
  leave: (id: string) => api.post(`${BASE}/conversations/${id}/leave`).then(() => undefined),
  markRead: (id: string) => api.post(`${BASE}/conversations/${id}/read`).then(() => undefined),
  upload: (conversationId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ChatAttachmentDto>(`${BASE}/conversations/${conversationId}/attachments`, form)
      .then((r) => r.data);
  },
  send: ({ conversationId, content, attachmentIds }: SendChatMessageInput) =>
    api
      .post<ChatMessageDto>(`${BASE}/conversations/${conversationId}/messages`, { content, attachmentIds })
      .then((r) => r.data),
  edit: (messageId: string, content: string) =>
    api.put<ChatMessageDto>(`${BASE}/messages/${messageId}`, { content }).then((r) => r.data),
  recall: (messageId: string) =>
    api.post<ChatMessageDto>(`${BASE}/messages/${messageId}/recall`).then((r) => r.data),
  /** The server decrypts the file; the bytes arrive over the authenticated session. */
  attachment: (messageId: string, attachmentId: string) =>
    api
      .get<Blob>(`${BASE}/messages/${messageId}/attachments/${attachmentId}`, { responseType: "blob" })
      .then((r) => r.data),
};
