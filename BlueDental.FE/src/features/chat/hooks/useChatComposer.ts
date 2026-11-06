import { useRef, useState } from "react";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { useSendChatMessage, useUploadChatAttachment } from "../api/chatMutations";
import { CHAT_LIMITS, type ChatMessageDto } from "../types";
import { rejectChatFile } from "../utils/chatFormat";
import { buildContent, parseDraft, type ChatMention } from "../utils/chatPatientTokens";
import { useEditSubmit } from "./useEditSubmit";

export interface PendingChatFile {
  key: string;
  name: string;
  /** Set once the upload is stored; the message sends these ids. */
  attachmentId?: string;
  /** Whole percent sent so far; at 100 the server is still scanning and sealing it. */
  progress: number;
}

let nextFileKey = 0;

/**
 * The composer's draft: text, the patients it tags with # (R-1161), files
 * uploaded ahead of sending, and the message being edited. Starting an edit
 * parks the draft; ending it brings the draft back. A fresh copy of the same message (after a clash with an
 * edit made elsewhere) keeps what is being typed.
 */
export function useChatComposer(
  conversationId: string,
  editing: ChatMessageDto | null,
  onEditingChange: (message: ChatMessageDto | null) => void,
) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [files, setFiles] = useState<PendingChatFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const parkedDraftRef = useRef<{ text: string; mentions: ChatMention[] }>({ text: "", mentions: [] });
  const upload = useUploadChatAttachment();
  const send = useSendChatMessage();
  const edit = useEditSubmit(conversationId, onEditingChange);

  // Adjusting state while rendering, React's pattern for "props changed".
  if ((editing?.id ?? null) !== editingId) {
    if (editing && editingId === null) parkedDraftRef.current = { text, mentions };
    const draft = editing ? parseDraft(editing.content ?? "") : parkedDraftRef.current;
    setText(draft.text);
    setMentions(draft.mentions);
    setEditingId(editing?.id ?? null);
  }

  const uploading = files.some((file) => !file.attachmentId);
  const ready = files.flatMap((file) => (file.attachmentId ? [file.attachmentId] : []));
  const busy = send.isPending || edit.saving;
  const hasText = text.trim().length > 0;
  // An edit keeps the files as sent, so a message with files may lose its words.
  const hasBody = editing ? hasText || editing.attachments.length > 0 : hasText || ready.length > 0;
  const canSubmit = !busy && !uploading && hasBody;

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
      setFiles((current) => [...current, { key, name: file.name, progress: 0 }]);
      const handleProgress = (progress: number) =>
        setFiles((current) => current.map((f) => (f.key === key ? { ...f, progress } : f)));
      // A failed upload is toasted by the global mutation handler; the chip just goes.
      upload
        .mutateAsync({ conversationId, file, onProgress: handleProgress })
        .then((stored) =>
          setFiles((current) => current.map((f) => (f.key === key ? { ...f, attachmentId: stored.id } : f))),
        )
        .catch(() => setFiles((current) => current.filter((f) => f.key !== key)));
    }
  };

  const removeFile = (key: string) => setFiles((current) => current.filter((file) => file.key !== key));

  const submit = () => {
    if (!canSubmit) return;
    const { content, patientIds } = buildContent(text.trim(), mentions);
    if (editing) {
      edit.save(editing, content, patientIds);
      return;
    }
    send.mutate(
      { conversationId, content, attachmentIds: ready, patientIds },
      {
        onSuccess: () => {
          setText("");
          setMentions([]);
          setFiles([]);
        },
      },
    );
  };

  const cancelEdit = () => onEditingChange(null);

  return { text, setText, mentions, setMentions, files, addFiles, removeFile, submit, cancelEdit, canSubmit, busy, uploading };
}
