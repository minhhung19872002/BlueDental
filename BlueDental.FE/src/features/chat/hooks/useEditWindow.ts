import { useEffect, useState } from "react";
import type { ChatMessageDto } from "../types";

/**
 * Whether "Sửa" may still be offered on a message (R-1159). The server decides
 * (`canEdit`, by its own clock) and says when the window closes; a timer hides
 * the action at that moment without a reload. The server still refuses a late
 * edit if this machine's clock runs slow.
 */
export function useEditWindow(message: ChatMessageDto): boolean {
  const { canEdit, editableUntil } = message;
  const [closedAt, setClosedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit || !editableUntil) return;
    const remaining = Math.max(Date.parse(editableUntil) - Date.now(), 0);
    const timer = window.setTimeout(() => setClosedAt(editableUntil), remaining);
    return () => window.clearTimeout(timer);
  }, [canEdit, editableUntil]);

  return canEdit && closedAt !== editableUntil;
}

/** True while `message` is still the caller's to edit by the time this is asked. */
export function isStillEditable(message: ChatMessageDto, now = Date.now()): boolean {
  return message.canEdit && message.editableUntil !== null && Date.parse(message.editableUntil) > now;
}
