import { Button, Tag } from "antd";
import { ClockCircleOutlined, SoundOutlined, UserOutlined } from "@ant-design/icons";
import { t, getLocale } from "@/lib/i18n";
import { QueueTicketPriority, type BoardTicket, type CounterBoard } from "../types";

interface CounterBoardCardProps {
  counter: CounterBoard;
  /** Position on the board; picks the card's accent (blue, purple, green, …). */
  index: number;
  canCall: boolean;
  calling: boolean;
  onCallNext: (counterId: string) => void;
}

const ACCENT_COUNT = 3;

function formatCalledAt(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
}

/** Section label; the Ưu tiên tag sits on this row when the ticket is urgent (owner). */
function LabelRow({ label, ticket }: { label: string; ticket: BoardTicket | null }) {
  return (
    <div className="queue-counter__label-row">
      <span className="queue-counter__label">{label}</span>
      {ticket?.priority === QueueTicketPriority.Urgent && (
        <Tag color="red" className="queue-counter__urgent">
          {t("Queue:Priority:Urgent")}
        </Tag>
      )}
    </div>
  );
}

function TicketLine({ ticket, numberClass }: { ticket: BoardTicket; numberClass: string }) {
  return (
    <div className="queue-counter__line">
      <span className={numberClass}>{ticket.displayNumber}</span>
      {ticket.serviceType && <span className="queue-counter__desc">{ticket.serviceType}</span>}
    </div>
  );
}

/** One reception counter: status, the number it serves, and the queue's next number. */
export function CounterBoardCard({ counter, index, canCall, calling, onCallNext }: CounterBoardCardProps) {
  const calledAt = formatCalledAt(counter.current?.calledAt);
  const className = [
    "queue-counter",
    `queue-counter--accent-${index % ACCENT_COUNT}`,
    !counter.isActive && "queue-counter--paused",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-testid={`counter-card-${counter.id}`}>
      <div className="queue-counter__head">
        <span className="queue-counter__identity">
          <span className="queue-counter__avatar" aria-hidden>
            <UserOutlined />
          </span>
          <span className="queue-counter__name">{counter.name}</span>
        </span>
        <span className="queue-counter__status">
          <span className="queue-counter__dot" aria-hidden />
          {counter.isActive ? t("Queue:Counter:Active") : t("Queue:Counter:Paused")}
        </span>
      </div>

      <div className="queue-counter__serving">
        <LabelRow label={t("Queue:Board:Serving")} ticket={counter.current} />
        {counter.current ? (
          <TicketLine ticket={counter.current} numberClass="queue-counter__number" />
        ) : (
          <span className="queue-counter__number queue-counter__number--idle">—</span>
        )}
        <span className="queue-counter__meta">
          <ClockCircleOutlined aria-hidden />
          {calledAt ?? t("Queue:Board:Idle")}
        </span>
      </div>

      <div className="queue-counter__next">
        <LabelRow label={t("Queue:Board:Next")} ticket={counter.next} />
        {counter.next ? (
          <TicketLine ticket={counter.next} numberClass="queue-counter__next-number" />
        ) : (
          <span className="queue-counter__next-number queue-counter__next-number--empty">
            {t("Queue:Board:NoNext")}
          </span>
        )}
      </div>

      {canCall && (
        <Button
          type="primary"
          block
          className="queue-counter__call"
          icon={<SoundOutlined />}
          loading={calling}
          disabled={!counter.isActive || calling}
          onClick={() => onCallNext(counter.id)}
        >
          {t("Queue:CallNext")}
        </Button>
      )}
    </div>
  );
}
