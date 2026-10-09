import { t } from "@/lib/i18n";
import type { CounterBoard } from "../types";
import { bareDentistName } from "../utils/dentistName";

interface DisplayCounterCardProps {
  counter: CounterBoard;
}

/** TV card for one counter: its dentist, the number being seen and the next ones. Numbers only, no PHI. */
export function DisplayCounterCard({ counter }: DisplayCounterCardProps) {
  const className = ["queue-tv__card", !counter.isActive && "queue-tv__card--paused"]
    .filter(Boolean)
    .join(" ");
  const more = counter.waitingCount - counter.upcoming.length;

  return (
    <div className={className}>
      <div className="queue-tv__head">
        <span className="queue-tv__avatar" aria-hidden>
          {counter.numberPrefix}
        </span>
        <span className="queue-tv__who">
          <span className="queue-tv__name">{counter.name}</span>
          {counter.dentistName && (
            <span className="queue-tv__dentist">
              {t("Queue:Card:Dentist", bareDentistName(counter.dentistName))}
            </span>
          )}
        </span>
      </div>
      <div className="queue-tv__label">{t("Queue:Board:Serving")}</div>
      <div className="queue-tv__number">
        {counter.isActive ? (counter.current?.displayNumber ?? "—") : t("Queue:Counter:Paused")}
      </div>
      <div className="queue-tv__next">
        <span className="queue-tv__next-label">{t("Queue:Board:Next")}</span>
        {counter.upcoming.length === 0
          ? "—"
          : counter.upcoming.map((ticket) => (
              <span key={ticket.id} className="queue-tv__chip">
                {ticket.displayNumber}
              </span>
            ))}
        {more > 0 && <span className="queue-tv__more">{t("Queue:Card:More", more)}</span>}
      </div>
    </div>
  );
}
