import { api } from "@/lib/axios";
import type {
  ChatAttachmentDto,
  ChatContactDto,
  ChatConversationDto,
  ChatMessageDto,
  ChatMessagePageDto,
  ChatMessageRevisionDto,
  ChatMessageSearchResultDto,
  ChatPatientSuggestionDto,
  ChatSharedFilePageDto,
  ChatSharedFilter,
  ChatSharedKind,
  ChatSharedLinkResultDto,
  ChatUnreadCountDto,
  CreateGroupChatInput,
  EditChatMessageInput,
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
  removeMember: (id: string, userId: string) =>
    api.delete(`${BASE}/conversations/${id}/members/${userId}`).then(() => undefined),
  /** POST so the words searched never reach a proxy log as a query string. */
  searchMessages: (id: string, text: string) =>
    api
      .post<ChatMessageSearchResultDto>(`${BASE}/conversations/${id}/messages/search`, { text })
      .then((r) => r.data),
  /** Kho lưu trữ (R-1160): pictures or other files sent in the conversation, newest first. */
  sharedFiles: (id: string, kind: ChatSharedKind, filter: ChatSharedFilter, skipCount: number, maxResultCount: number) =>
    api
      .get<ChatSharedFilePageDto>(`${BASE}/conversations/${id}/shared/files`, {
        params: { kind, ...filter, skipCount, maxResultCount },
      })
      .then((r) => r.data),
  sharedLinks: (id: string, filter: ChatSharedFilter) =>
    api.get<ChatSharedLinkResultDto>(`${BASE}/conversations/${id}/shared/links`, { params: filter }).then((r) => r.data),
  leave: (id: string) => api.post(`${BASE}/conversations/${id}/leave`).then(() => undefined),
  markRead: (id: string) => api.post(`${BASE}/conversations/${id}/read`).then(() => undefined),
  /** @param onProgress whole percent of the file sent so far, 0–100. */
  upload: (conversationId: string, file: File, onProgress?: (percent: number) => void, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ChatAttachmentDto>(`${BASE}/conversations/${conversationId}/attachments`, form, {
        signal,
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.min(100, Math.floor((event.loaded / event.total) * 100)));
        },
      })
      .then((r) => r.data);
  },
  send: ({ conversationId, content, attachmentIds, patientIds, clientMessageId }: SendChatMessageInput) =>
    api
      .post<ChatMessageDto>(`${BASE}/conversations/${conversationId}/messages`, {
        content,
        attachmentIds,
        patientIds,
        clientMessageId,
      })
      .then((r) => r.data),
  edit: ({ messageId, content, patientIds, expectedEditedAt }: EditChatMessageInput) =>
    api
      .put<ChatMessageDto>(`${BASE}/messages/${messageId}`, { content, patientIds, expectedEditedAt })
      .then((r) => r.data),
  /** Who # suggests (R-1161). POST, so the name being typed never reaches a URL or a proxy log. */
  patientSuggestions: (id: string, text: string) =>
    api
      .post<ChatPatientSuggestionDto[]>(`${BASE}/conversations/${id}/patient-suggestions`, { text })
      .then((r) => r.data),
  revisions: (messageId: string) =>
    api.get<ChatMessageRevisionDto[]>(`${BASE}/messages/${messageId}/revisions`).then((r) => r.data),
  recall: (messageId: string) =>
    api.post<ChatMessageDto>(`${BASE}/messages/${messageId}/recall`).then((r) => r.data),
  /** The server decrypts the file; the bytes arrive over the authenticated session. */
  attachment: (messageId: string, attachmentId: string) =>
    api
      .get<Blob>(`${BASE}/messages/${messageId}/attachments/${attachmentId}`, { responseType: "blob" })
      .then((r) => r.data),
};
