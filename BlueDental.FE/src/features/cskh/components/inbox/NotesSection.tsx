import { useState } from "react";
import { Button, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useConversationNotes, useCreateNote } from "../../api/inboxApi";
import { NoteEditor } from "./NoteEditor";
import { NoteItem } from "./NoteItem";

interface Props {
  conversationId: string;
  canEdit: boolean;
}

/**
 * "Ghi chú nội bộ" (BA P2210): free text; newest first; a deleted note stays,
 * struck through, with who deleted it.
 */
export function NotesSection({ conversationId, canEdit }: Props) {
  const notes = useConversationNotes(conversationId);
  const create = useCreateNote(conversationId);
  const [writing, setWriting] = useState(false);

  const handleCreate = (content: string) =>
    create.mutate({ id: conversationId, content }, { onSuccess: () => setWriting(false) });

  return (
    <section className="ibx-side-block" aria-label={t("CSKH:Inbox:Notes")}>
      <h4 className="ibx-side-title">{t("CSKH:Inbox:Notes")}</h4>
      {writing && (
        <NoteEditor
          initial=""
          saving={create.isPending}
          saveLabel={t("CSKH:Inbox:NoteSave")}
          onSave={handleCreate}
          onCancel={() => setWriting(false)}
        />
      )}
      <Spin spinning={notes.isLoading}>
        {notes.data?.length === 0 && !writing && <p className="ibx-side-text">{t("CSKH:Inbox:NoNotes")}</p>}
        <ul className="ibx-notes">
          {(notes.data ?? []).map((note) => (
            <NoteItem key={note.id} conversationId={conversationId} note={note} canEdit={canEdit} />
          ))}
        </ul>
      </Spin>
      {canEdit && !writing && (
        <Button size="small" icon={<PlusOutlined />} onClick={() => setWriting(true)}>
          {t("CSKH:Inbox:NoteAdd")}
        </Button>
      )}
    </section>
  );
}
