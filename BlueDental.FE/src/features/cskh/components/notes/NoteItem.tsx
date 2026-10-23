import { useState } from "react";
import { Button, Popover } from "antd";
import { DeleteOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { useDeleteNote, useUpdateNote, type CareNote } from "../../api/careNoteApi";
import { stamp } from "../../inboxLook";
import { NoteEditor } from "./NoteEditor";
import { NoteHistory } from "./NoteHistory";
import { OutcomePill } from "./OutcomePill";

interface Props {
  note: CareNote;
  canEdit: boolean;
  /** "li" in a plain note list; "div" inside a history line that is already an item. */
  as?: "li" | "div";
}

/**
 * One care note: who wrote it and when, who last changed it, and once deleted
 * the text struck through with who deleted it (BA P2210). Sửa and Xoá are open
 * to anyone caring for the customer; the history keeps each step.
 */
export function NoteItem({ note, canEdit, as: Tag = "li" }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const handleSave = (content: string) =>
    update.mutate({ id: note.id, content }, { onSuccess: () => setEditing(false) });

  const handleDelete = () => remove.mutate(note.id, { onSuccess: () => setConfirming(false) });

  if (editing) {
    return (
      <Tag className="cn-note">
        <NoteEditor
          initial={note.content}
          saving={update.isPending}
          saveLabel={t("CSKH:Inbox:NoteSaveEdit")}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </Tag>
    );
  }

  return (
    <Tag className={note.isRemoved ? "cn-note cn-note--removed" : "cn-note"}>
      {note.outcome && <OutcomePill outcome={note.outcome} />}
      <p className="cn-note-text">{note.content}</p>
      <p className="cn-note-meta">{t("CSKH:Inbox:NoteBy", note.authorName ?? "", stamp(note.createdAt))}</p>
      {note.lastEditedAt && (
        <p className="cn-note-meta">{t("CSKH:Inbox:NoteEditedBy", note.lastEditorName ?? "", stamp(note.lastEditedAt))}</p>
      )}
      {note.removedAt && (
        <p className="cn-note-meta cn-note-meta--removed">
          {t("CSKH:Inbox:NoteRemovedBy", note.removerName ?? "", stamp(note.removedAt))}
        </p>
      )}
      <div className="cn-note-actions">
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
    </Tag>
  );
}
