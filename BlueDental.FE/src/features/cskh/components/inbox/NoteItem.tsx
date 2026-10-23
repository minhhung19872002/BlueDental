import { useState } from "react";
import { Button, Popover } from "antd";
import { DeleteOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { useDeleteNote, useUpdateNote, type ConversationNote } from "../../api/inboxApi";
import { stamp } from "../../inboxLook";
import { NoteEditor } from "./NoteEditor";
import { NoteHistory } from "./NoteHistory";

interface Props {
  conversationId: string;
  note: ConversationNote;
  canEdit: boolean;
}

/**
 * One note: who wrote it and when, who last changed it, and once deleted the
 * text struck through with who deleted it (BA P2210). Sửa and Xoá are open to
 * anyone handling the inbox; the history keeps each step.
 */
export function NoteItem({ conversationId, note, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateNote(conversationId);
  const remove = useDeleteNote(conversationId);

  const handleSave = (content: string) =>
    update.mutate({ noteId: note.id, content }, { onSuccess: () => setEditing(false) });

  const handleDelete = () => remove.mutate(note.id, { onSuccess: () => setConfirming(false) });

  if (editing) {
    return (
      <li className="ibx-note">
        <NoteEditor
          initial={note.content}
          saving={update.isPending}
          saveLabel={t("CSKH:Inbox:NoteSaveEdit")}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={note.isRemoved ? "ibx-note ibx-note--removed" : "ibx-note"}>
      <p className="ibx-note-text">{note.content}</p>
      <p className="ibx-note-meta">{t("CSKH:Inbox:NoteBy", note.authorName ?? "", stamp(note.createdAt))}</p>
      {note.lastEditedAt && (
        <p className="ibx-note-meta">{t("CSKH:Inbox:NoteEditedBy", note.lastEditorName ?? "", stamp(note.lastEditedAt))}</p>
      )}
      {note.removedAt && (
        <p className="ibx-note-meta ibx-note-meta--removed">
          {t("CSKH:Inbox:NoteRemovedBy", note.removerName ?? "", stamp(note.removedAt))}
        </p>
      )}
      <div className="ibx-note-actions">
        <Popover trigger="click" placement="left" content={<NoteHistory revisions={note.revisions} />}>
          <Button size="small" type="text" icon={<HistoryOutlined />} aria-label={t("CSKH:Inbox:NoteHistory")} />
        </Popover>
        {canEdit && !note.isRemoved && (
          <>
            <Button size="small" type="text" icon={<EditOutlined />} aria-label={t("CSKH:Inbox:NoteEdit")} onClick={() => setEditing(true)} />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("CSKH:Inbox:NoteDelete")}
              onClick={() => setConfirming(true)}
            />
          </>
        )}
      </div>
      <ConfirmDeleteDialog
        open={confirming}
        noun={t("CSKH:Inbox:NoteNoun")}
        question={t("CSKH:Inbox:NoteDeleteQuestion")}
        note={t("CSKH:Inbox:NoteDeleteNote")}
        pending={remove.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirming(false)}
      />
    </li>
  );
}
