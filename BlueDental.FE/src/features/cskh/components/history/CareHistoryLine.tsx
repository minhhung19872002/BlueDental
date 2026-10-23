import { memo } from "react";
import { formatDateTime } from "@/utils/format";
import { HISTORY_KIND, type HistoryEntry } from "../../api/careHistoryApi";
import { NoteItem } from "../notes/NoteItem";
import { lineActor, lineLook } from "./careHistoryLook";

interface Props {
  entry: HistoryEntry;
  canEditNotes: boolean;
}

/**
 * One line of the history: badge, title with its result, what was said, when
 * and by whom. A note line is the note itself, so it can be changed or struck
 * from here, as from the chat.
 */
export const CareHistoryLine = memo(function CareHistoryLine({ entry, canEditNotes }: Props) {
  const look = lineLook(entry);

  return (
    <li className="ch-line">
      <span className={`ch-badge ch-badge--${look.badge.tone}`} aria-hidden="true">
        {look.badge.text}
      </span>
      <div className="ch-line-body">
        <p className="ch-line-head">
          <span className="ch-line-title">{look.title}</span>
          {look.pill && <span className={`ch-pill ch-pill--${look.pill.tone}`}>{look.pill.text}</span>}
        </p>
        {entry.kind === HISTORY_KIND.Note && entry.note ? (
          <NoteItem note={entry.note} canEdit={canEditNotes} as="div" />
        ) : (
          <>
            {entry.text && <p className="ch-line-text">{entry.text}</p>}
            <p className="ch-line-meta">{`${formatDateTime(entry.at)} · ${lineActor(entry)}`}</p>
          </>
        )}
      </div>
    </li>
  );
});
