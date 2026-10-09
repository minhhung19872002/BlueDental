import { ClockCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { bareDentistName } from "../utils/dentistName";
import { formatClock, minutesSince } from "../utils/waitLevel";
import { QueueTicketPriority, type CounterBoard } from "../types";
import { CounterCardActions, type CounterCardActionsConfig } from "./CounterCardActions";
import { CounterFacts, UpcomingNumbers } from "./CounterCardParts";

interface CounterBoardCardProps {
  counter: CounterBoard;
  /** Which of the board's colours (0 blue, 1 purple, 2 green) the card wears. */
  accent: number;
  now: number;
  actions: CounterCardActionsConfig;
}

/**
 * One counter on the board: its fixed dentist, the number being seen, its own
 * next numbers and waits. A click anywhere opens the counter's waiting list;
 * the list button is the keyboard way there.
 */
export function CounterBoardCard({ counter, accent, now, actions }: CounterBoardCardProps) {
  const current = counter.current;
  const className = [
    "queue-card",
    `queue-card--accent-${accent}`,
    !counter.isActive && "queue-card--paused",
  ]
    .filter(Boolean)
    .join(" ");
  const numberClass = [
    "queue-card__number",
    !current && "queue-card__number--none",
    current?.priority === QueueTicketPriority.Urgent && "queue-card__number--urgent",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-testid={`counter-card-${counter.id}`}
      onClick={() => actions.onOpen(counter.id)}
    >
      <div className="queue-card__head">
        <span className="queue-card__avatar" aria-hidden>
          {counter.numberPrefix}
        </span>
        <span className="queue-card__who">
          <span className="queue-card__name">{counter.name}</span>
          <span className="queue-card__dentist">
            {counter.dentistName
              ? t("Queue:Card:Dentist", bareDentistName(counter.dentistName))
              : t("Queue:Card:NoDentist")}
          </span>
        </span>
        <span className="queue-card__status">
          <span className="queue-card__dot" aria-hidden />
          {counter.isActive ? t("Queue:Counter:Active") : t("Queue:Counter:Paused")}
        </span>
      </div>

      <div className="queue-card__now">
        <span className="queue-card__label">{t("Queue:Card:Seeing")}</span>
        <span
          className={numberClass}
          title={
            current?.priority === QueueTicketPriority.Urgent
              ? t("Queue:Priority:Urgent")
              : undefined
          }
        >
          {current?.displayNumber ?? "—"}
        </span>
        <span className="queue-card__meta">
          <ClockCircleOutlined aria-hidden />
          {current?.calledAt
            ? t(
                "Queue:Card:CalledAt",
                formatClock(current.calledAt),
                minutesSince(current.calledAt, now),
              )
            : t("Queue:Board:Idle")}
        </span>
      </div>

      <UpcomingNumbers counter={counter} />
      <CounterFacts counter={counter} />

      <CounterCardActions counter={counter} actions={actions} />
    </div>
  );
}
