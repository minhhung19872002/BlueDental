import { Empty, Spin, Timeline } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { ACTIVITY_KIND, type TicketActivityDto } from "../api/ticketApi";
import { ACTIVITY_LABEL, CONTACT_RESULT_LABEL, TICKET_STATUS_CONFIG } from "./ticketConfig";

interface Props {
  activities: TicketActivityDto[] | undefined;
  loading: boolean;
}

/** One line's headline: what happened, with the detail that matters for its kind. */
function headline(activity: TicketActivityDto): string {
  const kind = t(ACTIVITY_LABEL[activity.kind]);
  if (activity.kind === ACTIVITY_KIND.Contact && activity.contactResult) {
    return `${kind}: ${t(CONTACT_RESULT_LABEL[activity.contactResult])}`;
  }
  if (activity.kind === ACTIVITY_KIND.Assigned) {
    return `${kind}: ${activity.assigneeName ?? t("Ticket:Pool")}`;
  }
  const { fromStatus, toStatus } = activity;
  if (fromStatus && toStatus && fromStatus !== toStatus) {
    return `${kind}: ${t(TICKET_STATUS_CONFIG[fromStatus].label)} → ${t(TICKET_STATUS_CONFIG[toStatus].label)}`;
  }
  return kind;
}

/** Lịch sử chăm sóc, newest first — every contact, hand-over and status move. */
export function TicketTimeline({ activities, loading }: Props) {
  if (loading) return <Spin />;
  if (!activities?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Ticket:NoActivity")} />;

  const items = activities.map((activity) => ({
    key: activity.id,
    children: (
      <div className="mkt-timeline__item">
        <div className="mkt-timeline__head">{headline(activity)}</div>
        {activity.note && <div className="mkt-timeline__note">{activity.note}</div>}
        {activity.nextCallAt && (
          <div className="mkt-timeline__meta">
            {t("Ticket:Field:NextCall")}: {dayjs(activity.nextCallAt).format("DD/MM/YYYY HH:mm")}
          </div>
        )}
        <div className="mkt-timeline__meta">
          {dayjs(activity.creationTime).format("DD/MM/YYYY HH:mm")}
          {activity.creatorName && ` · ${activity.creatorName}`}
        </div>
      </div>
    ),
  }));

  return <Timeline className="mkt-timeline" items={items} />;
}
