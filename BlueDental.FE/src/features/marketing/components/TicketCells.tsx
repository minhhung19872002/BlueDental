import { Tooltip } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { STATUS_TONE } from "@/theme/statusPalette";
import type { TicketDto } from "../api/ticketApi";
import { CONTACT_RESULT_LABEL, formatTicketTime } from "./ticketConfig";

/** The dash every list in the app prints for an empty cell. */
export function EmptyCell() {
  return <span className="bd-cat-num">—</span>;
}

/** Name over phone, the way every list in the app stacks a record's two lines. */
export function CustomerCell({ ticket }: { ticket: Pick<TicketDto, "fullName" | "phone" | "isReturningCustomer" | "patientCode"> }) {
  return (
    <div className="mkt-cell">
      <p className="bd-cat-name">{ticket.fullName}</p>
      <p className="bd-cat-subtle">{ticket.phone}</p>
      {ticket.isReturningCustomer && (
        <Tooltip title={ticket.patientCode ? t("Ticket:ReturningHint", ticket.patientCode) : undefined}>
          <span>
            <StatusBadge label={t("Ticket:Returning")} bg={STATUS_TONE.temporary.bg} color={STATUS_TONE.temporary.color} />
          </span>
        </Tooltip>
      )}
    </div>
  );
}

export function DueCell({ ticket }: { ticket: TicketDto }) {
  if (!ticket.dueAt) return <EmptyCell />;
  return (
    <div className="mkt-cell">
      <span className={ticket.isOverdue ? "mkt-overdue" : undefined}>{formatTicketTime(ticket.dueAt)}</span>
      {ticket.isOverdue && <StatusBadge label={t("Ticket:Overdue")} bg={STATUS_TONE.late.bg} color={STATUS_TONE.late.color} />}
    </div>
  );
}

export function LastContactCell({ ticket }: { ticket: TicketDto }) {
  if (!ticket.lastContactAt) return <EmptyCell />;
  return (
    <div className="mkt-cell">
      <p className="bd-cat-name">{ticket.lastContactResult ? t(CONTACT_RESULT_LABEL[ticket.lastContactResult]) : ""}</p>
      <p className="bd-cat-subtle">
        {formatTicketTime(ticket.lastContactAt)} · {t("Ticket:ContactCount", ticket.contactCount)}
      </p>
    </div>
  );
}
