import { t } from "@/lib/i18n";
import { formatClock } from "@/utils/format";
import { formatCardDate } from "@/features/labo/components/warranty/laboWarrantyRules";
import type { WarrantyCardRowDto, WarrantyEventDto } from "../../api/planWarrantyApi";
import type { HistoryDay } from "./planWarrantyView";
import { EVENT_SOURCE, eventSubline, eventTitle } from "./warrantyEventText";

interface Props {
  days: HistoryDay[];
  today: string;
  /** The activated cards, for the dentist and period under an activation. */
  cards: readonly WarrantyCardRowDto[];
}

function EventRow({ event, cards }: { event: WarrantyEventDto; cards: readonly WarrantyCardRowDto[] }) {
  const source = EVENT_SOURCE[event.source];
  const subline = eventSubline(event, cards);
  return (
    <li className="pwt-event">
      <time className="pwt-event-time" dateTime={event.at}>
        {formatClock(event.at)}
      </time>
      <div className="pwt-event-body">
        <p className="pwt-event-title">
          <span className={`pwt-source pwt-source--${source.tone}`}>{t(source.label)}</span>
          {eventTitle(event)}
        </p>
        {subline && <p className="pwt-sub">{subline}</p>}
      </div>
    </li>
  );
}

/** The days of LỊCH SỬ BẢO HÀNH, newest on top, each with its events by time (m371). */
export function WarrantyTimeline({ days, today, cards }: Props) {
  if (days.length === 0) return <p className="pwt-empty-note">{t("Treatment:Warranty:History:Empty")}</p>;

  return (
    <ol className="pwt-timeline">
      {days.map((day) => (
        <li key={day.day} className="pwt-day">
          <div className="pwt-day-date">
            <strong>{formatCardDate(day.day)}</strong>
            {day.day === today && <span>{t("Treatment:Warranty:TodayLabel")}</span>}
          </div>
          <ol className="pwt-day-events">
            {day.events.map((event, index) => (
              <EventRow key={`${event.at}-${event.kind}-${index}`} event={event} cards={cards} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
