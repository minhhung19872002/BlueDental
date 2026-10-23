import { useState } from "react";
import { Button, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useCareNotes, useCreateNote, type NoteOwner } from "../../api/careNoteApi";
import { NoteEditor } from "./NoteEditor";
import { NoteItem } from "./NoteItem";

interface Props {
  owner: NoteOwner;
  canEdit: boolean;
}

/**
 * "Ghi chú nội bộ" beside the chat (BA P2210): free text; newest first; a
 * deleted note stays, struck through, with who deleted it. The record's
 * Lịch sử chăm sóc shows the same notes.
 */
export function NotesSection({ owner, canEdit }: Props) {
  const notes = useCareNotes(owner);
  const create = useCreateNote();
  const [writing, setWriting] = useState(false);

  const handleCreate = (content: string) =>
    create.mutate({ owner, input: { content } }, { onSuccess: () => setWriting(false) });

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
        <ul className="cn-notes">
          {(notes.data ?? []).map((note) => (
            <NoteItem key={note.id} note={note} canEdit={canEdit} />
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
