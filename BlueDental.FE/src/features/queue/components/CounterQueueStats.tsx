import { t } from "@/lib/i18n";
import { formatClock, waitLevelOf } from "../utils/waitLevel";
import type { CounterQueue } from "../types";
import { QueueStatTile } from "./QueueStatTile";

/** The five figures above a counter's waiting list (mockup 3). */
export function CounterQueueStats({ queue }: { queue: CounterQueue }) {
  const { counter, waiting } = queue;
  const level = waitLevelOf(counter.longestWaitMinutes, counter.waitWarningMinutes);
  const first = waiting[0]?.displayNumber;
  const last = waiting[waiting.length - 1]?.displayNumber;
  const actual = queue.actualMinutesPerPatient;

  return (
    <section className="queue-detail__stats" aria-label={t("Queue:Detail:StatsTitle")}>
      <QueueStatTile
        label={t("Queue:Board:Serving")}
        value={counter.current?.displayNumber ?? "—"}
        sub={
          counter.current?.calledAt
            ? t("Queue:Detail:CalledAt", formatClock(counter.current.calledAt))
            : t("Queue:Board:Idle")
        }
      />
      <QueueStatTile
        label={t("Queue:Card:Waiting")}
        value={counter.waitingCount}
        sub={
          first ? (first === last ? first : `${first} → ${last}`) : t("Queue:Summary:NobodyWaiting")
        }
      />
      <QueueStatTile
        label={t("Queue:Card:Longest")}
        value={counter.waitingCount > 0 ? t("Queue:Minutes", counter.longestWaitMinutes) : "—"}
        level={counter.waitingCount > 0 ? level : undefined}
        sub={
          level === "danger"
            ? t("Queue:Detail:OverThreshold", counter.waitWarningMinutes)
            : t("Queue:Detail:Threshold", counter.waitWarningMinutes)
        }
      />
      <QueueStatTile
        label={t("Queue:Detail:MinutesPerPatient")}
        value={t("Queue:Minutes", actual ?? queue.configuredMinutesPerPatient)}
        sub={
          actual === null
            ? t("Queue:Detail:Configured", queue.configuredMinutesPerPatient)
            : t("Queue:Detail:ActualToday", queue.configuredMinutesPerPatient)
        }
      />
      <QueueStatTile
        label={t("Queue:Detail:NewWait")}
        value={counter.isActive ? t("Queue:Detail:About", counter.newTicketWaitMinutes) : "—"}
        sub={
          counter.isActive
            ? t("Queue:Detail:NextIssued", queue.nextNumber)
            : t("Queue:Card:PausedCounter")
        }
      />
    </section>
  );
}
