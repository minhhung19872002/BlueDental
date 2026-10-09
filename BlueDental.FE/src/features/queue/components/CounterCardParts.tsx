import { t } from "@/lib/i18n";
import { waitLevelOf } from "../utils/waitLevel";
import { QueueTicketPriority, type BoardTicket, type CounterBoard } from "../types";
import { WaitBadge } from "./WaitBadge";

/** A ticket number chip; urgent numbers carry the red edge. */
export function NumberChip({
  ticket,
}: {
  ticket: Pick<BoardTicket, "displayNumber" | "priority">;
}) {
  const urgent = ticket.priority === QueueTicketPriority.Urgent;
  return (
    <span
      className={["queue-chip", urgent && "queue-chip--urgent"].filter(Boolean).join(" ")}
      title={urgent ? t("Queue:Priority:Urgent") : undefined}
    >
      {ticket.displayNumber}
    </span>
  );
}

/** "Tiếp theo": the next three numbers, then "+n số" for the rest. */
export function UpcomingNumbers({ counter }: { counter: CounterBoard }) {
  const more = counter.waitingCount - counter.upcoming.length;
  return (
    <div className="queue-card__next">
      <span className="queue-card__label">{t("Queue:Board:Next")}</span>
      {counter.upcoming.length === 0 ? (
        <span className="queue-chip queue-chip--muted">{t("Queue:Board:NoNext")}</span>
      ) : (
        <span className="queue-card__chips">
          {counter.upcoming.map((ticket) => (
            <NumberChip key={ticket.id} ticket={ticket} />
          ))}
          {more > 0 && (
            <span className="queue-chip queue-chip--muted">{t("Queue:Card:More", more)}</span>
          )}
        </span>
      )}
    </div>
  );
}

/** Đang chờ · Chờ lâu nhất · Số mới chờ ~x′ */
export function CounterFacts({ counter }: { counter: CounterBoard }) {
  const level = waitLevelOf(counter.longestWaitMinutes, counter.waitWarningMinutes);
  return (
    <dl className="queue-card__facts">
      <div>
        <dt>{t("Queue:Card:Waiting")}</dt>
        <dd>{counter.waitingCount}</dd>
      </div>
      <div>
        <dt>{t("Queue:Card:Longest")}</dt>
        <dd>
          {counter.waitingCount > 0 ? (
            <WaitBadge level={level}>
              {t("Queue:MinutesShort", counter.longestWaitMinutes)}
            </WaitBadge>
          ) : (
            "—"
          )}
        </dd>
      </div>
      <div>
        <dt>{t("Queue:Card:NewWait")}</dt>
        {/* A paused counter hands out no number, so there is no wait to quote. */}
        <dd>{counter.isActive ? t("Queue:Card:About", counter.newTicketWaitMinutes) : "—"}</dd>
      </div>
    </dl>
  );
}
