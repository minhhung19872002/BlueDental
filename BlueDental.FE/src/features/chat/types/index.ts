/** Chat nội bộ (F-89) — mirrors BlueDental.Application.Contracts/Chat/ChatDtos.cs. */

export const CHAT_KIND = { Direct: 1, Group: 2 } as const;
export type ChatConversationKind = (typeof CHAT_KIND)[keyof typeof CHAT_KIND];

export interface ChatContactDto {
  id: string;
  fullName: string;
  userName: string;
}

export interface ChatMemberDto {
  userId: string;
  fullName: string;
}

export interface ChatAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeInBytes: number;
  isImage: boolean;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  isMine: boolean;
  /** Null once recalled, or for a files-only message. */
  content: string | null;
  sentAt: string;
  editedAt: string | null;
  isRecalled: boolean;
  attachments: ChatAttachmentDto[];
}

export interface ChatConversationDto {
  id: string;
  clinicBranchId: string;
  kind: ChatConversationKind;
  /** The group name, or the other person's name in a two-person chat. */
  title: string;
  name: string | null;
  members: ChatMemberDto[];
  lastMessage: ChatMessageDto | null;
  lastActivityAt: string;
  unreadCount: number;
}

export interface ChatMessagePageDto {
  /** Newest first. */
  items: ChatMessageDto[];
  hasMore: boolean;
}

export interface ChatUnreadCountDto {
  count: number;
}

export interface CreateGroupChatInput {
  name: string;
  memberIds: string[];
}

export interface SendChatMessageInput {
  conversationId: string;
  content: string;
  attachmentIds: string[];
}

/** Mirrors ChatConsts on the server; the server checks again. */
export const CHAT_LIMITS = {
  maxMessageLength: 4000,
  maxAttachmentsPerMessage: 10,
  maxAttachmentBytes: 20 * 1024 * 1024,
  maxGroupNameLength: 100,
  messagePageSize: 30,
} as const;

/** Mirrors ChatAttachmentFiles on the server. */
export const CHAT_FILE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf",
  ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".txt", ".csv",
] as const;
