import { t } from "@/lib/i18n";
import { NOTE_OUTCOME, type NoteOutcome } from "../../api/careNoteApi";

/** The two fixed "Kết quả cuộc gọi" tags, in their screen order (BA P2210). */
export const NOTE_OUTCOMES: readonly NoteOutcome[] = [NOTE_OUTCOME.Contacted, NOTE_OUTCOME.NoAnswer];

const OUTCOME_LOOK: Record<NoteOutcome, { className: string; label: string }> = {
  [NOTE_OUTCOME.Contacted]: { className: "cn-outcome--contacted", label: "CSKH:Note:Outcome:Contacted" },
  [NOTE_OUTCOME.NoAnswer]: { className: "cn-outcome--no-answer", label: "CSKH:Note:Outcome:NoAnswer" },
};

export function outcomeLabel(outcome: NoteOutcome): string {
  return t(OUTCOME_LOOK[outcome].label);
}

/** "Đã liên hệ" / "Không nghe máy" on a note that carries one. */
export function OutcomePill({ outcome }: { outcome: NoteOutcome }) {
  return <span className={`cn-outcome ${OUTCOME_LOOK[outcome].className}`}>{outcomeLabel(outcome)}</span>;
}
