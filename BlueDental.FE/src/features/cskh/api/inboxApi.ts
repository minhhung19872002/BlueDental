import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { CareType } from "./careApi";

/** Matches BlueDental.ZaloInbox.ZaloInboxTab. */
export const INBOX_TAB = { Unreplied: 0, Mine: 1, Cared: 2, All: 3 } as const;
export type InboxTab = (typeof INBOX_TAB)[keyof typeof INBOX_TAB];

/** Matches BlueDental.ZaloInbox.ZaloConversationStatus. */
export const CONVERSATION_STATUS = { Unreplied: 0, Cared: 1 } as const;
export type ConversationStatus = (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

/** Matches BlueDental.ZaloInbox.ZaloChatDirection. */
export const CHAT_DIRECTION = { Inbound: 0, Outbound: 1 } as const;
export type ChatDirection = (typeof CHAT_DIRECTION)[keyof typeof CHAT_DIRECTION];

/** Matches BlueDental.ZaloInbox.ZaloChatKind. */
export const CHAT_KIND = {
  Text: 0,
  Image: 1,
  Sticker: 2,
  File: 3,
  Link: 4,
  Audio: 5,
  Video: 6,
  Location: 7,
  Other: 9,
} as const;
export type ChatKind = (typeof CHAT_KIND)[keyof typeof CHAT_KIND];

/** Matches BlueDental.ZaloInbox.ZaloChatEntrySource. */
export const CHAT_SOURCE = { Chat: 0, Zns: 1 } as const;
export type ChatSource = (typeof CHAT_SOURCE)[keyof typeof CHAT_SOURCE];

/** Matches BlueDental.ZaloInbox.ZaloZnsState. */
export const ZNS_STATE = { Sent: 1, Delivered: 2, Failed: 3 } as const;
export type ZnsState = (typeof ZNS_STATE)[keyof typeof ZNS_STATE];

/** Matches BlueDental.ZaloInbox.ZaloNoteAction. */
export const NOTE_ACTION = { Created: 0, Edited: 1, Removed: 2 } as const;
export type NoteAction = (typeof NOTE_ACTION)[keyof typeof NOTE_ACTION];

/** Matches BlueDental.ZaloInbox.ZaloZnsBlock. */
export const ZNS_BLOCK = { NoPatient: 1, NoPhone: 2, MissingData: 3, NotConnected: 4 } as const;
export type ZnsBlock = (typeof ZNS_BLOCK)[keyof typeof ZNS_BLOCK];

/** Mirrors BlueDental.ZaloInbox.ZaloInboxConsts. */
export const INBOX_LIMITS = {
  message: 2000,
  note: 2000,
  tag: 30,
  tags: 10,
  holdMinutes: 15,
  replyWindowHours: 48,
  chatPage: 10,
} as const;

export interface InboxListInput {
  filter: string;
  tab: InboxTab;
}

export interface InboxCounts {
  unreplied: number;
  mine: number;
  cared: number;
  all: number;
}

export interface ConversationSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  sharedPhone: string | null;
  patientId: string | null;
  patientCode: string | null;
  patientName: string | null;
  patientPhone: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: ChatDirection | null;
  lastCustomerMessageAt: string | null;
  holderId: string | null;
  holderName: string | null;
  heldUntil: string | null;
  tags: string[];
}

export interface InboxList {
  connected: boolean;
  oaName: string | null;
  items: ConversationSummary[];
  counts: InboxCounts;
}

export interface CustomerPanel {
  patientId: string;
  code: string;
  name: string;
  phone: string | null;
  nextAppointmentAt: string | null;
  lastVisitAt: string | null;
  activeServices: string[];
  dentistName: string | null;
  seesMoney: boolean;
  totalAmount: number | null;
  paidAmount: number | null;
  dueAmount: number | null;
}

export interface ConversationDetail extends ConversationSummary {
  replyWindowEndsAt: string | null;
  canReplyFreely: boolean;
  customer: CustomerPanel | null;
}

export interface ChatEntry {
  key: string;
  source: ChatSource;
  direction: ChatDirection;
  kind: ChatKind;
  text: string;
  attachmentUrl: string | null;
  sentAt: string;
  senderName: string | null;
  templateName: string | null;
  znsState: ZnsState | null;
}

export interface SyncResult {
  added: number;
  hasMore: boolean;
  error: string | null;
}

export interface InboxAssignee {
  id: string;
  name: string;
}

export interface InboxPatient {
  id: string;
  name: string;
  code: string;
  phone: string | null;
}

export interface NoteRevision {
  action: NoteAction;
  before: string | null;
  after: string | null;
  actorName: string | null;
  at: string;
}

export interface ConversationNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  lastEditorName: string | null;
  lastEditedAt: string | null;
  isRemoved: boolean;
  removerName: string | null;
  removedAt: string | null;
  revisions: NoteRevision[];
}

export interface InboxTemplate {
  id: string;
  name: string;
  purpose: CareType | null;
  externalTemplateId: string | null;
  creationTime: string;
}

export interface ZnsPreview {
  templateId: string;
  templateName: string;
  params: { name: string; value: string }[];
  missing: string[];
  previewUrl: string | null;
  phone: string | null;
  price: number | null;
  block: ZnsBlock | null;
}

const BASE = "/v1/app/zalo-inbox";
const conversationPath = (id: string) => `${BASE}/conversations/${id}`;

const inboxApi = {
  list: (input: InboxListInput) =>
    api
      .get<InboxList>(`${BASE}/conversations`, { params: { filter: input.filter || undefined, tab: input.tab } })
      .then((r) => r.data),
  counts: () => api.get<InboxCounts>(`${BASE}/counts`).then((r) => r.data),
  get: (id: string) => api.get<ConversationDetail>(conversationPath(id)).then((r) => r.data),
  messages: (id: string) => api.get<ChatEntry[]>(`${conversationPath(id)}/messages`).then((r) => r.data),
  syncRecent: () => api.post<SyncResult>(`${BASE}/sync`).then((r) => r.data),
  syncConversation: ({ id, offset }: { id: string; offset: number }) =>
    api.post<SyncResult>(`${conversationPath(id)}/sync`, { offset }).then((r) => r.data),
  claim: (id: string) => api.post<ConversationDetail>(`${conversationPath(id)}/claim`).then((r) => r.data),
  release: (id: string) => api.post<ConversationDetail>(`${conversationPath(id)}/release`).then((r) => r.data),
  transfer: ({ id, userId }: { id: string; userId: string }) =>
    api.post<ConversationDetail>(`${conversationPath(id)}/transfer`, { userId }).then((r) => r.data),
  assignees: () => api.get<InboxAssignee[]>(`${BASE}/assignees`).then((r) => r.data),
  send: ({ id, text }: { id: string; text: string }) =>
    api.post<ChatEntry>(`${conversationPath(id)}/messages`, { text }).then((r) => r.data),
  setTags: ({ id, tags }: { id: string; tags: string[] }) =>
    api.put<string[]>(`${conversationPath(id)}/tags`, { tags }).then((r) => r.data),
  tagSuggestions: () => api.get<string[]>(`${BASE}/tags`).then((r) => r.data),
  linkPatient: ({ id, patientId }: { id: string; patientId: string | null }) =>
    api.put<ConversationDetail>(`${conversationPath(id)}/patient`, { patientId }).then((r) => r.data),
  patients: (filter: string) =>
    api.get<InboxPatient[]>(`${BASE}/patients`, { params: { filter: filter || undefined } }).then((r) => r.data),
  notes: (id: string) => api.get<ConversationNote[]>(`${conversationPath(id)}/notes`).then((r) => r.data),
  createNote: ({ id, content }: { id: string; content: string }) =>
    api.post<ConversationNote>(`${conversationPath(id)}/notes`, { content }).then((r) => r.data),
  updateNote: ({ noteId, content }: { noteId: string; content: string }) =>
    api.put<ConversationNote>(`${BASE}/notes/${noteId}`, { content }).then((r) => r.data),
  deleteNote: (noteId: string) => api.delete<ConversationNote>(`${BASE}/notes/${noteId}`).then((r) => r.data),
  templates: () => api.get<InboxTemplate[]>(`${BASE}/zns-templates`).then((r) => r.data),
  previewZns: ({ id, templateId }: { id: string; templateId: string }) =>
    api.post<ZnsPreview>(`${conversationPath(id)}/zns/preview`, { templateId }).then((r) => r.data),
  sendZns: ({ id, templateId }: { id: string; templateId: string }) =>
    api.post<ChatEntry>(`${conversationPath(id)}/zns`, { templateId }).then((r) => r.data),
};

export const inboxKeys = {
  all: ["zalo-inbox"] as const,
  lists: () => [...inboxKeys.all, "list"] as const,
  list: (input: InboxListInput) => [...inboxKeys.lists(), input] as const,
  counts: () => [...inboxKeys.lists(), "counts"] as const,
  detail: (id: string) => [...inboxKeys.all, "detail", id] as const,
  messages: (id: string) => [...inboxKeys.all, "messages", id] as const,
  notes: (id: string) => [...inboxKeys.all, "notes", id] as const,
  assignees: () => [...inboxKeys.all, "assignees"] as const,
  tags: () => [...inboxKeys.all, "tags"] as const,
  patients: (filter: string) => [...inboxKeys.all, "patients", filter] as const,
  templates: () => [...inboxKeys.all, "templates"] as const,
  preview: (id: string, templateId: string) => [...inboxKeys.all, "preview", id, templateId] as const,
};

/**
 * New messages come in by Zalo's webhook; the screen reads them back every
 * few seconds (the inbox has no push channel of its own yet).
 */
const LIST_POLL_MS = 10_000;
const CHAT_POLL_MS = 5_000;

export function useInboxList(input: InboxListInput) {
  return useQuery({
    queryKey: inboxKeys.list(input),
    queryFn: () => inboxApi.list(input),
    placeholderData: keepPreviousData,
    refetchInterval: LIST_POLL_MS,
  });
}

/** The "Hộp thư Zalo 4" badge: kept fresh on every CSKH tab, not just the inbox. */
export function useInboxCounts(enabled: boolean) {
  return useQuery({ queryKey: inboxKeys.counts(), queryFn: inboxApi.counts, enabled, refetchInterval: LIST_POLL_MS });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: inboxKeys.detail(id ?? ""),
    queryFn: id ? () => inboxApi.get(id) : skipToken,
    refetchInterval: LIST_POLL_MS,
  });
}

export function useConversationMessages(id: string | null) {
  return useQuery({
    queryKey: inboxKeys.messages(id ?? ""),
    queryFn: id ? () => inboxApi.messages(id) : skipToken,
    refetchInterval: CHAT_POLL_MS,
  });
}

/** Whatever changed a conversation changes its row, its header and maybe its chat. */
function useInvalidateInbox() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: inboxKeys.lists() });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.messages(id) });
    }
  };
}

/** A conversation step returns the conversation as it now is: put it straight in the cache. */
function useConversationMutation<TInput extends { id: string } | string>(
  mutationFn: (input: TInput) => Promise<ConversationDetail>,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(inboxKeys.detail(detail.id), detail);
      invalidate(detail.id);
    },
  });
}

export function useSyncRecent() {
  const invalidate = useInvalidateInbox();
  return useMutation({ mutationFn: inboxApi.syncRecent, onSuccess: () => invalidate() });
}

export function useSyncConversation() {
  const invalidate = useInvalidateInbox();
  return useMutation({ mutationFn: inboxApi.syncConversation, onSuccess: (_, { id }) => invalidate(id) });
}

export const useClaimConversation = () => useConversationMutation(inboxApi.claim);
export const useReleaseConversation = () => useConversationMutation(inboxApi.release);
export const useTransferConversation = () => useConversationMutation(inboxApi.transfer);
export const useLinkPatient = () => useConversationMutation(inboxApi.linkPatient);

export function useInboxAssignees(enabled: boolean) {
  return useQuery({ queryKey: inboxKeys.assignees(), queryFn: inboxApi.assignees, enabled });
}

export function useSendChatMessage() {
  const invalidate = useInvalidateInbox();
  return useMutation({ mutationFn: inboxApi.send, onSuccess: (_, { id }) => invalidate(id) });
}

export function useSetTags() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: inboxApi.setTags,
    onSuccess: (_, { id }) => {
      invalidate(id);
      void queryClient.invalidateQueries({ queryKey: inboxKeys.tags() });
    },
  });
}

export function useTagSuggestions(enabled: boolean) {
  return useQuery({ queryKey: inboxKeys.tags(), queryFn: inboxApi.tagSuggestions, enabled });
}

export function useInboxPatients(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: inboxKeys.patients(filter),
    queryFn: () => inboxApi.patients(filter),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useConversationNotes(id: string) {
  return useQuery({ queryKey: inboxKeys.notes(id), queryFn: () => inboxApi.notes(id) });
}

function useNoteMutation<TInput>(conversationId: string, mutationFn: (input: TInput) => Promise<ConversationNote>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: inboxKeys.notes(conversationId) }),
  });
}

export const useCreateNote = (conversationId: string) => useNoteMutation(conversationId, inboxApi.createNote);
export const useUpdateNote = (conversationId: string) => useNoteMutation(conversationId, inboxApi.updateNote);
export const useDeleteNote = (conversationId: string) => useNoteMutation(conversationId, inboxApi.deleteNote);

export function useInboxTemplates() {
  return useQuery({ queryKey: inboxKeys.templates(), queryFn: inboxApi.templates });
}

/** Read again on every pick: the customer's data may have changed since the last one. */
export function useZnsPreview(id: string, templateId: string | null) {
  return useQuery({
    queryKey: inboxKeys.preview(id, templateId ?? ""),
    queryFn: templateId ? () => inboxApi.previewZns({ id, templateId }) : skipToken,
    staleTime: 0,
    retry: false,
  });
}

export function useSendZns() {
  const invalidate = useInvalidateInbox();
  return useMutation({ mutationFn: inboxApi.sendZns, onSuccess: (_, { id }) => invalidate(id) });
}
