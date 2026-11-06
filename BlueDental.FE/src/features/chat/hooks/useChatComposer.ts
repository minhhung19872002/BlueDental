import { useRef, useState } from "react";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { useEditChatMessage, useSendChatMessage, useUploadChatAttachment } from "../api/chatMutations";
import { CHAT_LIMITS, type ChatMessageDto } from "../types";
import { rejectChatFile } from "../utils/chatFormat";

export interface PendingChatFile {
  key: string;
  name: string;
  /** Set once the upload is stored; the message sends these ids. */
  attachmentId?: string;
}

let nextFileKey = 0;

/**
 * The composer's draft: text, files uploaded ahead of sending, and the
 * message being edited. Starting an edit parks the draft; ending it brings
 * the draft back.
 */
export function useChatComposer(conversationId: string, editing: ChatMessageDto | null, onEditDone: () => void) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingChatFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const parkedDraftRef = useRef("");
  const upload = useUploadChatAttachment();
  const send = useSendChatMessage();
  const edit = useEditChatMessage();

  // Adjusting state while rendering, React's pattern for "props changed".
  if ((editing?.id ?? null) !== editingId) {
    if (editing && editingId === null) parkedDraftRef.current = text;
    setText(editing ? (editing.content ?? "") : parkedDraftRef.current);
    setEditingId(editing?.id ?? null);
  }

  const uploading = files.some((file) => !file.attachmentId);
  const ready = files.flatMap((file) => (file.attachmentId ? [file.attachmentId] : []));
  const busy = send.isPending || edit.isPending;
  const hasText = text.trim().length > 0;
  const canSubmit = !busy && !uploading && (editing ? hasText : hasText || ready.length > 0);

  const addFiles = (picked: File[]) => {
    const room = CHAT_LIMITS.maxAttachmentsPerMessage - files.length;
    if (picked.length > room) notifyError(t("Chat:TooManyFiles", CHAT_LIMITS.maxAttachmentsPerMessage));
    for (const file of picked.slice(0, Math.max(room, 0))) {
      const reason = rejectChatFile(file);
      if (reason) {
        notifyError(reason);
        continue;
      }
      const key = `f${++nextFileKey}`;
      setFiles((current) => [...current, { key, name: file.name }]);
      // A failed upload is toasted by the global mutation handler; the chip just goes.
      upload
        .mutateAsync({ conversationId, file })
        .then((stored) =>
          setFiles((current) => current.map((f) => (f.key === key ? { ...f, attachmentId: stored.id } : f))),
        )
        .catch(() => setFiles((current) => current.filter((f) => f.key !== key)));
    }
  };

  const removeFile = (key: string) => setFiles((current) => current.filter((file) => file.key !== key));

  const submit = () => {
    if (!canSubmit) return;
    const content = text.trim();
    if (editing) {
      edit.mutate({ messageId: editing.id, content }, { onSuccess: onEditDone });
      return;
    }
    send.mutate(
      { conversationId, content, attachmentIds: ready },
      {
        onSuccess: () => {
          setText("");
          setFiles([]);
        },
      },
    );
  };

  return { text, setText, files, addFiles, removeFile, submit, canSubmit, busy, uploading };
}
