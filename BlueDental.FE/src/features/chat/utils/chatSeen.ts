import dayjs from "dayjs";
import type { ChatMemberDto, ChatMessageDto } from "../types";

/**
 * "Đã xem" (R-1178). Every member has one read mark: the moment they last
 * opened the thread with something new in it. A message counts as seen by
 * them when it was sent no later than that mark.
 */

/** A member who stopped reading at a given message, and when. */
export interface ChatReader {
  userId: string;
  fullName: string;
  readAt: string;
}

/** One line of the "who has seen it" dialog; the time only where it is that message's. */
export interface ChatSeenEntry {
  userId: string;
  fullName: string;
  readAt: string | null;
}

const NO_READERS: readonly ChatReader[] = [];

// Compared as instants: the server keeps µs, so the strings may differ in length.
const instant = (iso: string) => Date.parse(iso);

/** Seen by `member`: sent no later than their read mark. */
export function hasSeen(member: ChatMemberDto, message: ChatMessageDto): boolean {
  return member.lastReadAt !== null && instant(message.sentAt) <= instant(member.lastReadAt);
}

/**
 * Where each other member stopped reading: the newest loaded message sent no
 * later than their read mark, keyed by message id (`messages` oldest first).
 * A mark older than every loaded message places nobody, and nobody is shown
 * under a message they wrote themselves — sending it is reading it.
 */
export function readersByMessage(
  messages: readonly ChatMessageDto[],
  members: readonly ChatMemberDto[],
): Map<string, ChatReader[]> {
  const byMessage = new Map<string, ChatReader[]>();
  for (const member of members) {
    if (member.isMe || member.lastReadAt === null) continue;
    const stop = messages.findLast((message) => hasSeen(member, message));
    if (!stop || stop.senderId === member.userId) continue;
    const readers = byMessage.get(stop.id) ?? [];
    readers.push({ userId: member.userId, fullName: member.fullName, readAt: member.lastReadAt });
    byMessage.set(stop.id, readers);
  }
  // Latest reader first, so the first avatars are the freshest.
  for (const readers of byMessage.values()) {
    readers.sort((a, b) => instant(b.readAt) - instant(a.readAt));
  }
  return byMessage;
}

export function readersAt(byMessage: Map<string, ChatReader[]>, messageId: string): readonly ChatReader[] {
  return byMessage.get(messageId) ?? NO_READERS;
}

/**
 * The dialog behind the avatars: the other members who have and have not seen
 * `message` (its sender and the viewer are left out). A time shows only for
 * people whose mark rests on this very message; for those who read on, the
 * mark's time is when they read something later, not this.
 */
export function seenDetail(
  message: ChatMessageDto,
  members: readonly ChatMemberDto[],
  stoppedHere: readonly ChatReader[],
): { seen: ChatSeenEntry[]; notSeen: ChatMemberDto[] } {
  const here = new Set(stoppedHere.map((reader) => reader.userId));
  const others = members.filter((member) => !member.isMe && member.userId !== message.senderId);
  const seen = others
    .filter((member) => hasSeen(member, message))
    .sort((a, b) => instant(b.lastReadAt ?? "") - instant(a.lastReadAt ?? ""))
    .map((member) => ({
      userId: member.userId,
      fullName: member.fullName,
      readAt: here.has(member.userId) ? member.lastReadAt : null,
    }));
  const notSeen = others
    .filter((member) => !hasSeen(member, message))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
  return { seen, notSeen };
}

/** Today "14:32", this year "08/11 14:32", older "08/11/2025 14:32". */
export function formatSeenTime(iso: string, now = dayjs()): string {
  const at = dayjs(iso);
  if (at.isSame(now, "day")) return at.format("HH:mm");
  if (at.isSame(now, "year")) return at.format("DD/MM HH:mm");
  return at.format("DD/MM/YYYY HH:mm");
}
