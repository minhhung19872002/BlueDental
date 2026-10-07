import type { ReactNode } from "react";
import { Descriptions, Drawer } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useTicket, useTicketActivities, type TicketDto } from "../api/ticketApi";
import type { TicketTagDto } from "../api/ticketSupportApi";
import { CHANNEL_LABEL } from "./ticketConfig";
import { TicketRowActions, type TicketRowAction, type TicketRowRights } from "./TicketRowActions";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketTagChips } from "./TicketTagChips";
import { TicketTimeline } from "./TicketTimeline";

interface Props {
  ticketId: string | null;
  tags: Map<string, TicketTagDto>;
  sourceName: (ticket: TicketDto) => string | null;
  rights: TicketRowRights;
  onAction: (action: TicketRowAction, ticket: TicketDto) => void;
  onClose: () => void;
}

const formatTime = (value?: string | null) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—");

/** The ticket's details and its whole care history, with the same actions as its row. */
export function TicketDetailDrawer({ ticketId, tags, sourceName, rights, onAction, onClose }: Props) {
  const { data: ticket } = useTicket(ticketId ?? undefined);
  const activities = useTicketActivities(ticketId ?? undefined);

  const rows: { label: string; value: ReactNode }[] = ticket
    ? [
        { label: t("Ticket:Field:Phone"), value: ticket.phone },
        { label: t("Ticket:Field:Email"), value: ticket.email ?? "—" },
        { label: t("Common:Status"), value: <TicketStatusBadge ticket={ticket} /> },
        { label: t("Ticket:Field:Assignee"), value: ticket.assigneeName ?? t("Ticket:Pool") },
        { label: t("Ticket:Field:Source"), value: sourceName(ticket) ?? "—" },
        { label: t("Ticket:Field:ChannelIn"), value: t(CHANNEL_LABEL[ticket.channel]) },
        { label: t("Ticket:Field:Tags"), value: <TicketTagChips tagIds={ticket.tagIds} tags={tags} /> },
        { label: t("Ticket:Col:Due"), value: formatTime(ticket.dueAt) },
        { label: t("Ticket:Col:NextCall"), value: formatTime(ticket.nextCallAt) },
        { label: t("Ticket:Col:Appointment"), value: formatTime(ticket.appointmentStart) },
        { label: t("Ticket:Field:Patient"), value: ticket.patientCode ?? t("Ticket:NoPatient") },
        { label: t("Ticket:Col:Received"), value: formatTime(ticket.receivedAt) },
        { label: t("Ticket:Field:Note"), value: ticket.note ?? "—" },
      ]
    : [];

  return (
    <Drawer
      open={ticketId !== null}
      size={520}
      title={ticket ? `${ticket.code} · ${ticket.fullName}` : t("Ticket:Detail")}
      extra={ticket && !ticket.isDeleted && <TicketRowActions ticket={ticket} rights={rights} onAction={onAction} />}
      onClose={onClose}
      destroyOnHidden
    >
      <Descriptions column={1} size="small" className="mkt-detail">
        {rows.map((row) => (
          <Descriptions.Item key={row.label} label={row.label}>
            {row.value}
          </Descriptions.Item>
        ))}
      </Descriptions>
      <h3 className="mkt-section-title">{t("Ticket:History")}</h3>
      <TicketTimeline activities={activities.data} loading={activities.isLoading} />
    </Drawer>
  );
}
