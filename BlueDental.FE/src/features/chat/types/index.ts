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
  /** The patients the message tags with #, in order (R-1161); none once recalled. */
  patients: ChatPatientCardDto[];
}

/** Mirrors ChatPatientVisitStatus: today's visit in the Tiếp nhận wording. */
export const CHAT_VISIT_STATUS = {
  Scheduled: 1,
  Late: 2,
  Arrived: 3,
  InTreatment: 4,
  Completed: 5,
  Cancelled: 6,
} as const;
export type ChatVisitStatus = (typeof CHAT_VISIT_STATUS)[keyof typeof CHAT_VISIT_STATUS];

/**
 * A tagged patient under a message (R-1161), built by the server when read.
 * Never a phone number, history, allergy or diagnosis. Without Patients.View
 * only the name and Mã KH come, and the card does not open the record.
 */
export interface ChatPatientCardDto {
  id: string;
  /** Deleted, or no longer in the conversation's branch: nothing else is filled. */
  missing: boolean;
  name: string | null;
  patientCode: string | null;
  yearOfBirth: number | null;
  canOpen: boolean;
  /** Today's appointment, when there is one. */
  appointmentAt: string | null;
  dentistName: string | null;
  visitStatus: ChatVisitStatus | null;
  /** Nội dung đặt lịch of today's appointment. */
  bookingContent: string | null;
}

/** One row of the # list: today's patients first, then the rest of the branch. */
export interface ChatPatientSuggestionDto {
  id: string;
  name: string;
  patientCode: string;
  yearOfBirth: number | null;
  todayAt: string | null;
  isToday: boolean;
}

/** What the # list shows besides its rows. */
export type PatientSuggestStatus = "ready" | "loading" | "error" | "limit";

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
  /** The patients the text tags, at most CHAT_LIMITS.maxPatientsPerMessage. */
  patientIds: string[];
  /** Same on every retry of one message, so the server stores it once (R-1162). */
  clientMessageId?: string;
}

/** Mirrors ChatConsts on the server; the server checks again. */
export const CHAT_LIMITS = {
  maxMessageLength: 4000,
  maxAttachmentsPerMessage: 10,
  maxAttachmentBytes: 50 * 1024 * 1024,
  maxGroupNameLength: 100,
  maxSearchTextLength: 100,
  messagePageSize: 30,
  sharedFilePageSize: 60,
  maxPatientsPerMessage: 5,
  maxPatientSearchLength: 50,
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
  /** The patients that wording tagged. */
  patients: ChatPatientCardDto[];
}

export interface EditChatMessageInput {
  messageId: string;
  content: string;
  patientIds: string[];
  /** The message's editedAt when editing began; another edit since then is refused. */
  expectedEditedAt: string | null;
}

/** Server error codes the chat reacts to beyond the toast. */
export const CHAT_ERROR_CODES = {
  editWindowExpired: "BlueDental:Chat:0023",
  editConflict: "BlueDental:Chat:0024",
} as const;

/** Kho lưu trữ (R-1160): which files a tab lists. Mirrors ChatSharedFileKind. */
export const CHAT_SHARED_KIND = { Media: 1, File: 2 } as const;
export type ChatSharedKind = (typeof CHAT_SHARED_KIND)[keyof typeof CHAT_SHARED_KIND];

/** Clinic days as YYYY-MM-DD, both ends included; an absent field does not filter. */
export interface ChatSharedFilter {
  senderId?: string;
  sentFrom?: string;
  sentTo?: string;
}

interface ChatSharedItemDto {
  messageId: string;
  senderId: string;
  senderName: string;
  sentAt: string;
}

export interface ChatSharedFileDto extends ChatSharedItemDto {
  attachment: ChatAttachmentDto;
}

/** Newest message first. */
export interface ChatSharedFilePageDto {
  items: ChatSharedFileDto[];
  hasMore: boolean;
}

export interface ChatSharedLinkDto extends ChatSharedItemDto {
  /** Always http or https. */
  url: string;
}

/** Newest first; at most 200, from the 5,000 newest messages. */
export interface ChatSharedLinkResultDto {
  items: ChatSharedLinkDto[];
  /** False when older messages were not looked through. */
  isComplete: boolean;
}
