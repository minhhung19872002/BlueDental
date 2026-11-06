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
  /** Server says the caller may still edit it (sender, not recalled, inside the window). */
  canEdit: boolean;
  /** When the edit window closes; null when the caller may never edit it (R-1159). */
  editableUntil: string | null;
  attachments: ChatAttachmentDto[];
}

export interface ChatConversationDto {
  id: string;
  clinicBranchId: string;
  kind: ChatConversationKind;
  /** The group name, or the other person's name in a two-person chat. */
  title: string;
  name: string | null;
  /** The group member who may remove others; null for a two-person chat. */
  ownerId: string | null;
  isOwnedByMe: boolean;
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

/** Newest first; at most 50, from the 5,000 newest messages (R-1158). */
export interface ChatMessageSearchResultDto {
  items: ChatMessageDto[];
  /** False when there may be more matches than were returned. */
  isComplete: boolean;
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
  maxAttachmentBytes: 50 * 1024 * 1024,
  maxGroupNameLength: 100,
  maxSearchTextLength: 100,
  messagePageSize: 30,
} as const;

/** Mirrors ChatAttachmentFiles on the server. */
export const CHAT_FILE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf",
  ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".txt", ".csv",
] as const;

/** An earlier wording of an edited message (R-1159). */
export interface ChatMessageRevisionDto {
  /** Null when the message carried only files at that point. */
  content: string | null;
  /** When this wording was replaced. */
  editedAt: string;
}

export interface EditChatMessageInput {
  messageId: string;
  content: string;
  /** The message's editedAt when editing began; another edit since then is refused. */
  expectedEditedAt: string | null;
}

/** Server error codes the chat reacts to beyond the toast. */
export const CHAT_ERROR_CODES = {
  editWindowExpired: "BlueDental:Chat:0023",
  editConflict: "BlueDental:Chat:0024",
} as const;
