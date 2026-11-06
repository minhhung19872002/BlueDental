import { useEffect, useRef, useState } from "react";
import { useSendChatMessage } from "../api/chatMutations";
import type { ChatMessageDto } from "../types";
import { createClientIdKeeper } from "../utils/clientMessageId";
import { buildContent, parseDraft, type ChatMention } from "../utils/chatPatientTokens";
import { useEditSubmit } from "./useEditSubmit";
import { usePendingUploads } from "./usePendingUploads";

export type { PendingChatFile } from "./usePendingUploads";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const parkedDraftRef = useRef<{ text: string; mentions: ChatMention[] }>({ text: "", mentions: [] });
  const [clientIds] = useState(createClientIdKeeper);
  const uploads = usePendingUploads(conversationId);
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

  const busy = send.isPending || edit.saving;
  const hasText = text.trim().length > 0;
  // An edit keeps the files as sent, so a message with files may lose its words.
  const hasBody = editing ? hasText || editing.attachments.length > 0 : hasText || uploads.ready.length > 0;
  const canSubmit = !busy && (editing !== null || (!uploads.uploading && !uploads.failed)) && hasBody;

  // A reload or tab close while a file or the message is on its way asks first (I1.7).
  const inFlight = uploads.uploading || send.isPending;
  useEffect(() => {
    if (!inFlight) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [inFlight]);

  const submit = () => {
    if (!canSubmit) return;
    const { content, patientIds } = buildContent(text.trim(), mentions);
    if (editing) {
      edit.save(editing, content, patientIds);
      return;
    }
    const attachmentIds = uploads.ready;
    // Same draft sent again (after an error) keeps its id, so it is stored once.
    const clientMessageId = clientIds.idFor(JSON.stringify([content, attachmentIds, patientIds]));
    send.mutate(
      { conversationId, content, attachmentIds, patientIds, clientMessageId },
      {
        onSuccess: () => {
          clientIds.reset();
          setText("");
          setMentions([]);
          uploads.clear();
        },
      },
    );
  };

  const cancelEdit = () => onEditingChange(null);

  return {
    text,
    setText,
    mentions,
    setMentions,
    uploads,
    submit,
    cancelEdit,
    canSubmit,
    busy,
  };
}
