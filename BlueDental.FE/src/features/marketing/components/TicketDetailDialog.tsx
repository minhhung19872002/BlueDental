import type { ReactNode } from "react";
import { Modal } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useTicket, useTicketActivities, type TicketDto } from "../api/ticketApi";
import type { TicketTagDto } from "../api/ticketSupportApi";
import { CHANNEL_LABEL } from "./ticketConfig";
import { TicketDetailFooter } from "./TicketDetailFooter";
import type { TicketRowAction, TicketRowRights } from "./TicketRowActions";
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

interface Field {
  label: string;
  value: ReactNode;
  /** Free text takes the whole row of the grid. */
  wide?: boolean;
}

const formatTime = (value?: string | null) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—");

function detailFields(ticket: TicketDto, tags: Map<string, TicketTagDto>, sourceName: Props["sourceName"]): Field[] {
  return [
    { label: t("Ticket:Field:Phone"), value: ticket.phone },
    { label: t("Ticket:Field:Email"), value: ticket.email ?? "—" },
    { label: t("Common:Status"), value: <TicketStatusBadge ticket={ticket} /> },
    { label: t("Ticket:Field:Assignee"), value: ticket.assigneeName ?? t("Ticket:Pool") },
    { label: t("Ticket:Field:Source"), value: sourceName(ticket) ?? "—" },
    { label: t("Ticket:Field:ChannelIn"), value: t(CHANNEL_LABEL[ticket.channel]) },
    { label: t("Ticket:Col:Received"), value: formatTime(ticket.receivedAt) },
    { label: t("Ticket:Col:Due"), value: formatTime(ticket.dueAt) },
    { label: t("Ticket:Col:NextCall"), value: formatTime(ticket.nextCallAt) },
    { label: t("Ticket:Col:Appointment"), value: formatTime(ticket.appointmentStart) },
    { label: t("Ticket:Field:Patient"), value: ticket.patientCode ?? t("Ticket:NoPatient") },
    { label: t("Ticket:Field:Tags"), value: <TicketTagChips tagIds={ticket.tagIds} tags={tags} /> },
    { label: t("Ticket:Field:Note"), value: ticket.note ?? "—", wide: true },
  ];
}

/**
 * The ticket's details as a field grid, its whole care history below, and the
 * row's actions in the footer — a modal like the app's other detail views
 * (owner, 2026-10-07).
 */
export function TicketDetailDialog({ ticketId, tags, sourceName, rights, onAction, onClose }: Props) {
  const { data: ticket } = useTicket(ticketId ?? undefined);
  const activities = useTicketActivities(ticketId ?? undefined);

  return (
    <Modal
      open={ticketId !== null}
      // The title is the dialog's accessible name: a heading only, no buttons.
      title={<h2 className="bd-modal-title">{ticket ? `${ticket.code} · ${ticket.fullName}` : t("Ticket:Detail")}</h2>}
      onCancel={onClose}
      width="min(1120px, calc(100vw - 32px))"
      centered
      destroyOnHidden
      footer={<TicketDetailFooter ticket={ticket} rights={rights} onAction={onAction} />}
      className="app-dialog mkt-detail-dialog"
    >
      <div className="mkt-detail">
        <section className="mkt-detail-block">
          <h3 className="mkt-section-title">{t("Ticket:Info")}</h3>
          {ticket && (
            <dl className="mkt-detail-fields">
              {detailFields(ticket, tags, sourceName).map((field) => (
                <div key={field.label} className={field.wide ? "mkt-detail-field mkt-detail-field--wide" : "mkt-detail-field"}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section className="mkt-detail-block mkt-detail-history">
          <h3 className="mkt-section-title">{t("Ticket:History")}</h3>
          <div className="mkt-detail-history__list">
            <TicketTimeline activities={activities.data} loading={activities.isLoading} />
          </div>
        </section>
      </div>
    </Modal>
  );
}
