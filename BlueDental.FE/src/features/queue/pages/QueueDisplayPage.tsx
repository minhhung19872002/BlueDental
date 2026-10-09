import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t, getLocale } from "@/lib/i18n";
import { useDisplayBoard } from "../api/queueQueries";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
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

/**
 * Public TV board: one compact card per counter so ten fit on one screen.
 * Numbers and the counter's dentist only — no buttons, no PHI.
 */
export function QueueDisplayPage() {
  const [params] = useSearchParams();
  const branchId = params.get("branchId") ?? "";
  const now = useCurrentTime();
  const { data: counters } = useDisplayBoard(branchId);

  useQueueSignalR({ branchId });

  if (!branchId) {
    return (
      <div className="queue-tv">
        <div className="queue-tv__empty">{t("Queue:Display:MissingBranch")}</div>
      </div>
    );
  }

  const boardCounters = counters ?? [];

  return (
    <div className="queue-tv">
      <header className="queue-tv__header">
        <div className="queue-tv__title">{t("Queue:Display:Title")}</div>
        <div className="queue-tv__time">
          {now.toLocaleDateString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}{" "}
          — {now.toLocaleTimeString(getLocale())}
        </div>
      </header>

      {boardCounters.length === 0 ? (
        <div className="queue-tv__empty">{t("Queue:Board:Empty")}</div>
      ) : (
        <main className="queue-tv__grid">
          {boardCounters.map((counter) => (
            <DisplayCounterCard key={counter.id} counter={counter} />
          ))}
        </main>
      )}

      <footer className="queue-tv__footer">BlueDental — {t("Queue:Display:Footer")}</footer>
    </div>
  );
}
