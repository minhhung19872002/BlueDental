import { t } from "@/lib/i18n";
import { waitLevelOf } from "../utils/waitLevel";
import type { CounterBoard } from "../types";
import { QueueStatTile } from "./QueueStatTile";

interface BoardSummaryProps {
  counters: CounterBoard[];
}

function longestWaitingCounter(counters: CounterBoard[]): CounterBoard | null {
  return counters.reduce<CounterBoard | null>(
    (worst, counter) =>
      counter.waitingCount > 0 && counter.longestWaitMinutes > (worst?.longestWaitMinutes ?? -1)
        ? counter
        : worst,
    null,
  );
}

/** "20–40 phút" when counters warn at different waits, "30 phút" when they agree. */
function thresholdText(counters: CounterBoard[]): string {
  if (counters.length === 0) return "—";
  const values = counters.map((c) => c.waitWarningMinutes);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? t("Queue:Minutes", low) : t("Queue:MinutesRange", low, high);
}

/** "34 phút · Quầy số 2" — the counter named after the figure, small and muted like the mockup. */
function ValueWithNote({ value, note }: { value: string | number; note: string }) {
  return (
    <>
      {value}
      <span className="queue-stat__note">{note}</span>
    </>
  );
}

/** The four figures over the board — no sub-lines (owner, 2026-10-09). */
export function BoardSummary({ counters }: BoardSummaryProps) {
  const serving = counters.filter((c) => c.isActive).length;
  const waiting = counters.reduce((sum, c) => sum + c.waitingCount, 0);
  const worst = longestWaitingCounter(counters);

  return (
    <section className="queue-summary" aria-label={t("Queue:Summary:Title")}>
      <QueueStatTile
        label={t("Queue:Summary:Serving")}
        value={<ValueWithNote value={serving} note={` / ${counters.length}`} />}
      />
      <QueueStatTile label={t("Queue:Summary:Waiting")} value={waiting} />
      <QueueStatTile
        label={t("Queue:Summary:Longest")}
        value={
          worst ? (
            <ValueWithNote
              value={t("Queue:Minutes", worst.longestWaitMinutes)}
              note={` · ${worst.name}`}
            />
          ) : (
            "—"
          )
        }
        level={worst ? waitLevelOf(worst.longestWaitMinutes, worst.waitWarningMinutes) : undefined}
      />
      <QueueStatTile label={t("Queue:Summary:Threshold")} value={thresholdText(counters)} />
    </section>
  );
}
