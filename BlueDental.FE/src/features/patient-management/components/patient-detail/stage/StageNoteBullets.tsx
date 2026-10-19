import type { ReactNode } from "react";
import { noteLines } from "./stageNoteLines";

interface Props {
  note: string | null | undefined;
  /** What stands in for a note with no lines; nothing by default. */
  empty?: ReactNode;
}

/**
 * A công đoạn's "Nội dung điều trị" read out one dash per line (BA,
 * 2026-10-19, R-983) — the treatment table, the history in Chi tiết phiếu, its
 * print and the recall listing. Notes saved before the dashes came in have
 * none, so the markers are stripped and the list draws them, never doubled.
 */
export function StageNoteBullets({ note, empty = null }: Props) {
  const lines = noteLines(note);
  if (lines.length === 0) return empty;
  return (
    <ul className="pd-note-list">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}
