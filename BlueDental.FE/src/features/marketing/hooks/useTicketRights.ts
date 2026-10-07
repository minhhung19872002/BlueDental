import { useAbility } from "@/hooks/useAbility";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { TicketDto } from "../api/ticketApi";
import type { TicketRowRights } from "../components/TicketRowActions";

/**
 * What the account may do on the Ticket screen, from its marketingTicket leaves.
 * The server checks the same leaves; this only decides what to offer.
 */
export function useTicketRights() {
  const ticket = useAbility("marketingTicket");
  const appointment = useAbility("appointment");
  const currentBranchId = useCurrentBranchId();

  const rows: TicketRowRights = {
    update: ticket.canUpdate,
    transfer: ticket.can("transfer"),
    remove: ticket.canDelete,
    // The booking lands on the screen's branch, so only that branch's tickets may book (Marketing:0012).
    book: (row: TicketDto) => appointment.canCreate && row.clinicBranchId === currentBranchId,
  };

  return {
    rows,
    create: ticket.canCreate,
    /** Sees every ticket, not only their own and the pool. */
    readAll: ticket.can("readAll"),
  };
}
