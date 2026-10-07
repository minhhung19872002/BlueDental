import { TICKET_STATUS, type TicketFilter, type TicketStats, type TicketStatus } from "./api/ticketApi";

/**
 * The status row above the Ticket table: everything, one tab per status, then
 * the two attention filters. Each tab is also a counter, read from `/stats`.
 */
export type StatusTabKey = "all" | "new" | "inCare" | "booked" | "arrived" | "notPotential" | "overdue" | "callBack";

interface StatusTab {
  key: StatusTabKey;
  /** i18n key. */
  label: string;
  stat: keyof TicketStats;
  /** The half of the server filter this tab stands for. */
  filter: Pick<TicketFilter, "statuses" | "overdueOnly" | "callBackDue">;
}

const byStatus = (key: StatusTabKey, label: string, stat: keyof TicketStats, status: TicketStatus): StatusTab => ({
  key,
  label,
  stat,
  filter: { statuses: [status] },
});

export const STATUS_TABS: readonly StatusTab[] = [
  { key: "all", label: "Ticket:Tab:All", stat: "total", filter: {} },
  byStatus("new", "Ticket:Status:New", "new", TICKET_STATUS.New),
  byStatus("inCare", "Ticket:Status:InCare", "inCare", TICKET_STATUS.InCare),
  byStatus("booked", "Ticket:Status:Booked", "booked", TICKET_STATUS.Booked),
  byStatus("arrived", "Ticket:Status:Arrived", "arrived", TICKET_STATUS.Arrived),
  byStatus("notPotential", "Ticket:Status:NotPotential", "notPotential", TICKET_STATUS.NotPotential),
  { key: "overdue", label: "Ticket:Tab:Overdue", stat: "overdue", filter: { overdueOnly: true } },
  { key: "callBack", label: "Ticket:Tab:CallBackDue", stat: "callBackDue", filter: { callBackDue: true } },
];

export function statusTabFilter(key: StatusTabKey): StatusTab["filter"] {
  return STATUS_TABS.find((tab) => tab.key === key)?.filter ?? {};
}
