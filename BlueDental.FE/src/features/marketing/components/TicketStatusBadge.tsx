import { Tooltip } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { TICKET_STATUS, type TicketDto } from "../api/ticketApi";
import { TICKET_STATUS_CONFIG } from "./ticketConfig";

interface Props {
  ticket: Pick<TicketDto, "status" | "notPotentialReason">;
}

/** The status chip; a Không tiềm năng one says why on hover. */
export function TicketStatusBadge({ ticket }: Props) {
  const { label, bg, color } = TICKET_STATUS_CONFIG[ticket.status];
  const badge = <StatusBadge label={t(label)} bg={bg} color={color} />;

  if (ticket.status === TICKET_STATUS.NotPotential && ticket.notPotentialReason) {
    return <Tooltip title={ticket.notPotentialReason}>{badge}</Tooltip>;
  }
  return badge;
}
