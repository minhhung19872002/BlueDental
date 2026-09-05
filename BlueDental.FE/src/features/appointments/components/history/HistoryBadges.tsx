import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { HistoryAction, HistoryEntry, HistorySource } from "../../types/appointmentHistory";
import {
  ACTION_META,
  STATUS_GROUP_META,
  actionLabel,
  sourceLabel,
  statusTransition,
  type HistoryTone,
} from "./historyLabels";

/** The action pill: a dot, the reference's coloured circle, and the word. */
export function ActionBadge({ action }: { action: HistoryAction }) {
  const meta = ACTION_META[action];
  return (
    <span className={cn("ah-badge", `ah-badge--${meta.tone}`)}>
      <span aria-hidden="true" className={cn("ah-dot", `ah-dot--${meta.tone}`)} />
      <span aria-hidden="true">{meta.emoji}</span>
      <span>{actionLabel(action)}</span>
    </span>
  );
}

export function SourceBadge({ source }: { source: HistorySource }) {
  return <span className="ah-source">{sourceLabel(source)}</span>;
}

/** The small uppercase pills the detail head carries ("THÔNG TIN", "LỊCH HẸN"). */
export function HistoryPill({ tone = "gray", children }: { tone?: HistoryTone; children: ReactNode }) {
  return <span className={cn("ah-pill", `ah-pill--${tone}`)}>{children}</span>;
}

/** The status cell, coloured by where the appointment ended up. */
export function StatusText({ entry }: { entry: HistoryEntry }) {
  const tone = entry.statusAfter ? STATUS_GROUP_META[entry.statusAfter].tone : "gray";
  return <span className={cn("ah-status", `ah-status--${tone}`)}>{statusTransition(entry)}</span>;
}
