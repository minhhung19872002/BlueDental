import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t, getLocale } from "@/lib/i18n";
import { useQueueDisplay } from "../api/queueQueries";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { QueueTicketStatus, type QueueDisplayItem } from "../types";
import "../components/queue.css";

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface CounterGroup {
  counterId: string | undefined;
  counterName: string;
  calledItems: QueueDisplayItem[];
  servingItems: QueueDisplayItem[];
}

function groupByCounter(items: QueueDisplayItem[]): CounterGroup[] {
  const map = new Map<string | undefined, CounterGroup>();

  for (const item of items) {
    if (item.status !== QueueTicketStatus.Called && item.status !== QueueTicketStatus.Serving)
      continue;

    const key = item.counterId ?? undefined;
    let group = map.get(key);
    if (!group) {
      group = {
        counterId: key,
        counterName: item.counterName ?? t("Queue:Display:DefaultCounter"),
        calledItems: [],
        servingItems: [],
      };
      map.set(key, group);
    }
    if (item.status === QueueTicketStatus.Called) group.calledItems.push(item);
    if (item.status === QueueTicketStatus.Serving) group.servingItems.push(item);
  }

  return [...map.values()];
}

export function QueueDisplayPage() {
  const [params] = useSearchParams();
  const branchId = params.get("branchId") ?? "";
  const counterId = params.get("counterId") ?? undefined;
  const now = useCurrentTime();

  const { data: items } = useQueueDisplay(branchId, counterId);

  const [lastCalled, setLastCalled] = useState<{
    displayNumber: string;
    callCount: number;
  } | null>(null);

  useQueueSignalR({
    branchId,
    onTicketCalled: (payload) => {
      setLastCalled({
        displayNumber: payload.displayNumber,
        callCount: payload.callCount,
      });
    },
  });

  if (!branchId) {
    return (
      <div className="queue-display">
        <div className="queue-display__empty">
          {t("Queue:Display:MissingBranch")}
        </div>
      </div>
    );
  }

  const allItems = items ?? [];
  const counterGroups = groupByCounter(allItems);
  const waitingItems = allItems.filter(
    (i) => i.status === QueueTicketStatus.Waiting,
  );

  const hasMultipleCounters = counterGroups.length > 1;

  return (
    <div className="queue-display">
      <div className="queue-display__header">
        <div className="queue-display__title">
          {t("Queue:Display:Title")}
        </div>
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
        {hasMultipleCounters ? (
          <div className="queue-display__counters">
            {counterGroups.map((group) => {
              const currentNumber =
                group.calledItems[0]?.displayNumber ?? "—";
              return (
                <div key={group.counterId ?? "default"} className="queue-display__counter-card">
                  <div className="queue-display__counter-name">{group.counterName}</div>
                  <div className="queue-display__counter-number">{currentNumber}</div>
                  {group.servingItems.length > 0 && (
                    <div className="queue-display__counter-serving">
                      {t("Queue:Display:Serving")}: {group.servingItems.map((i) => i.displayNumber).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="queue-display__current">
            <div className="queue-display__current-label">
              {counterGroups[0]?.counterName
                ? counterGroups[0].counterName
                : t("Queue:Display:CurrentCalling")}
            </div>
            <div className="queue-display__current-number">
              {counterGroups[0]?.calledItems[0]?.displayNumber
                ?? lastCalled?.displayNumber
                ?? "—"}
            </div>
            {counterGroups[0]?.servingItems && counterGroups[0].servingItems.length > 0 && (
              <div className="queue-display__current-status">
                {t("Queue:Display:Serving")}: {counterGroups[0].servingItems.map((i) => i.displayNumber).join(", ")}
              </div>
            )}
          </div>
        )}

        <div className="queue-display__waiting">
          <div className="queue-display__waiting-title">
            {t("Queue:Display:Waiting")} ({waitingItems.length})
          </div>
          {waitingItems.length === 0 ? (
            <div style={{ textAlign: "center", opacity: 0.4, marginTop: 40 }}>
              {t("Queue:Display:NoWaiting")}
            </div>
          ) : (
            <div className="queue-display__waiting-list">
              {waitingItems.map((item) => (
                <WaitingItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="queue-display__footer">
        BlueDental — {t("Queue:Display:Footer")}
      </div>
    </div>
  );
}

function WaitingItem({ item }: { item: QueueDisplayItem }) {
  const classes = [
    "queue-display__waiting-item",
    item.priority === 1 && "queue-display__waiting-item--urgent",
    item.status === QueueTicketStatus.Called && "queue-display__waiting-item--called",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{item.displayNumber}</div>;
}
