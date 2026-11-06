import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { CHAT_FILE_EXTENSIONS, CHAT_LIMITS, type ChatMessageDto } from "../types";

/** Today → "14:05", this year → "05/11", older → "05/11/2025". */
export function formatChatTime(iso: string, now = dayjs()): string {
  const at = dayjs(iso);
  if (at.isSame(now, "day")) return at.format("HH:mm");
  if (at.isSame(now, "year")) return at.format("DD/MM");
  return at.format("DD/MM/YYYY");
}

/** Inside a thread: the time alone today, the date and time before. */
export function formatMessageTime(iso: string, now = dayjs()): string {
  const at = dayjs(iso);
  return at.isSame(now, "day") ? at.format("HH:mm") : at.format("DD/MM/YYYY HH:mm");
}

/** One line under a conversation's title. */
export function previewMessage(message: ChatMessageDto | null): string {
  if (!message) return "";
  const body = message.isRecalled
    ? t("Chat:Recalled")
    : message.content?.trim() || t("Chat:FilesOnly", message.attachments.length);
  return message.isMine ? `${t("Chat:You")}: ${body}` : body;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const last = words.at(-1) ?? "";
  return (words.length > 1 ? `${words[0][0]}${last[0]}` : last.slice(0, 2)).toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A file name without the invisible characters that can disguise it: a
 * right-to-left override (U+202E) makes "hoadon<RLO>fdp.exe" read as
 * "hoadonexe.pdf". The server strips the same ones before it checks the
 * extension (R-1158); names stored before that are cleaned here for display.
 */
export function displayFileName(name: string): string {
  return name.replace(/[\p{Cf}\p{Cc}\p{Zl}\p{Zp}]/gu, "").trim();
}

const ALLOWED = new Set<string>(CHAT_FILE_EXTENSIONS);
export const CHAT_FILE_ACCEPT = CHAT_FILE_EXTENSIONS.join(",");

/** Why a picked file cannot be sent, or null when it can. The server checks again. */
export function rejectChatFile(file: File): string | null {
  // Windows drops trailing dots and spaces, so "a.exe." would open as "a.exe".
  const name = displayFileName(file.name).replace(/[. ]+$/, "");
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (!ALLOWED.has(extension)) return t("Chat:FileTypeNotAllowed", name);
  if (file.size > CHAT_LIMITS.maxAttachmentBytes) {
    return t("Chat:FileTooLarge", name, CHAT_LIMITS.maxAttachmentBytes / (1024 * 1024));
  }
  return null;
}
