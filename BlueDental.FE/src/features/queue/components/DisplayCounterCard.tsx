import { t } from "@/lib/i18n";
import type { CounterBoard } from "../types";

interface DisplayCounterCardProps {
  counter: CounterBoard;
}

/** TV card for one counter: the number it serves and the number it will call next. */
export function DisplayCounterCard({ counter }: DisplayCounterCardProps) {
  const className = [
    "queue-display__counter-card",
    !counter.isActive && "queue-display__counter-card--paused",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="queue-display__counter-name">
        {counter.name}
        {!counter.isActive && (
          <span className="queue-display__counter-paused">{t("Queue:Counter:Paused")}</span>
        )}
      </div>
      <div className="queue-display__counter-label">{t("Queue:Board:Serving")}</div>
      <div className="queue-display__counter-number">{counter.current?.displayNumber ?? "—"}</div>
      <div className="queue-display__counter-serving">
        {t("Queue:Board:Next")}: {counter.next?.displayNumber ?? "—"}
      </div>
    </div>
  );
}
