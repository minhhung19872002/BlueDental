import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t, getLocale } from "@/lib/i18n";
import { useDisplayBoard, useQueueDisplay } from "../api/queueQueries";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { QueueTicketStatus, QueueTicketPriority, type QueueDisplayItem } from "../types";
import { DisplayCounterCard } from "../components/DisplayCounterCard";
import "../components/queue.css";

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Public TV board: one card per counter plus the shared waiting list. No PHI. */
export function QueueDisplayPage() {
  const [params] = useSearchParams();
  const branchId = params.get("branchId") ?? "";
  const now = useCurrentTime();

  const { data: counters } = useDisplayBoard(branchId);
  const { data: items } = useQueueDisplay(branchId);
  const [lastCalled, setLastCalled] = useState<string | null>(null);

  useQueueSignalR({
    branchId,
    onTicketCalled: (payload) => setLastCalled(payload.displayNumber),
  });

  if (!branchId) {
    return (
      <div className="queue-display">
        <div className="queue-display__empty">{t("Queue:Display:MissingBranch")}</div>
      </div>
    );
  }

  const boardCounters = counters ?? [];
  const waitingItems = (items ?? []).filter((i) => i.status === QueueTicketStatus.Waiting);

  return (
    <div className="queue-display">
      <div className="queue-display__header">
        <div className="queue-display__title">{t("Queue:Display:Title")}</div>
        <div className="queue-display__time">
          {now.toLocaleDateString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}{" "}
          — {now.toLocaleTimeString(getLocale())}
        </div>
      </div>

      <div className="queue-display__body">
        {boardCounters.length > 0 ? (
          <div className="queue-display__counters">
            {boardCounters.map((counter) => (
              <DisplayCounterCard key={counter.id} counter={counter} />
            ))}
          </div>
        ) : (
          <div className="queue-display__current">
            <div className="queue-display__current-label">{t("Queue:Display:CurrentCalling")}</div>
            <div className="queue-display__current-number">{lastCalled ?? "—"}</div>
          </div>
        )}

        <div className="queue-display__waiting">
          <div className="queue-display__waiting-title">
            {t("Queue:Display:Waiting")} ({waitingItems.length})
          </div>
          {waitingItems.length === 0 ? (
            <div className="queue-display__waiting-empty">{t("Queue:Display:NoWaiting")}</div>
          ) : (
            <div className="queue-display__waiting-list">
              {waitingItems.map((item) => (
                <WaitingItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="queue-display__footer">BlueDental — {t("Queue:Display:Footer")}</div>
    </div>
  );
}

function WaitingItem({ item }: { item: QueueDisplayItem }) {
  const classes = [
    "queue-display__waiting-item",
    item.priority === QueueTicketPriority.Urgent && "queue-display__waiting-item--urgent",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{item.displayNumber}</div>;
}
