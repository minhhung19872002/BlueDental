import { t } from "@/lib/i18n";
import { NOTE_ACTION, type NoteAction, type NoteRevision } from "../../api/inboxApi";
import { stamp } from "../../inboxLook";

const ACTION_LABEL: Record<NoteAction, string> = {
  [NOTE_ACTION.Created]: "CSKH:Inbox:NoteLog:Created",
  [NOTE_ACTION.Edited]: "CSKH:Inbox:NoteLog:Edited",
  [NOTE_ACTION.Removed]: "CSKH:Inbox:NoteLog:Removed",
};

/** The note's log: Tạo, each Sửa with the text it replaced, Xoá — who and when, oldest first. */
export function NoteHistory({ revisions }: { revisions: NoteRevision[] }) {
  return (
    <ol className="ibx-note-log" aria-label={t("CSKH:Inbox:NoteHistory")}>
      {revisions.map((revision) => (
        <li key={`${revision.action}-${revision.at}`}>
          <span className="ibx-note-log-head">
            {t(ACTION_LABEL[revision.action], revision.actorName ?? "", stamp(revision.at))}
          </span>
          {revision.action === NOTE_ACTION.Edited && revision.before && (
            <span className="ibx-note-log-before">{t("CSKH:Inbox:NoteLog:Before", revision.before)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
