import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import type { TicketDto } from "../api/ticketApi";
import type { TicketTagDto } from "../api/ticketSupportApi";
import { CustomerCell, DueCell, EmptyCell, LastContactCell } from "./TicketCells";
import { formatTicketTime } from "./ticketConfig";
import { TicketRowActions, type TicketRowAction, type TicketRowRights } from "./TicketRowActions";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketTagChips } from "./TicketTagChips";

export interface TicketColumnContext {
  tags: Map<string, TicketTagDto>;
  /** "Nguồn · Kênh" for a ticket, from Danh mục → Nguồn đến. */
  sourceName: (ticket: TicketDto) => string | null;
  rights: TicketRowRights;
  onAction: (action: TicketRowAction, ticket: TicketDto) => void;
}

const timeColumn = (title: string, dataIndex: keyof TicketDto) => ({
  title,
  dataIndex,
  width: 170,
  render: (value?: string | null) => formatTicketTime(value) ?? <EmptyCell />,
});

export function ticketColumns(context: TicketColumnContext): ColumnsType<TicketDto> {
  return [
    { title: t("Ticket:Col:Code"), dataIndex: "code", width: 110, fixed: "left" },
    { title: t("Ticket:Col:Customer"), key: "customer", width: 200, render: (_: unknown, row) => <CustomerCell ticket={row} /> },
    {
      title: t("Ticket:Col:Source"),
      key: "source",
      width: 160,
      ellipsis: true,
      render: (_: unknown, row) => context.sourceName(row) ?? <EmptyCell />,
    },
    {
      title: t("Ticket:Col:Tags"),
      dataIndex: "tagIds",
      width: 180,
      render: (tagIds: string[]) => <TicketTagChips tagIds={tagIds} tags={context.tags} />,
    },
    {
      title: t("Ticket:Col:Assignee"),
      dataIndex: "assigneeName",
      width: 150,
      render: (name?: string | null) => name ?? <span className="bd-cat-num">{t("Ticket:Pool")}</span>,
    },
    { title: t("Common:Status"), dataIndex: "status", width: 140, render: (_: unknown, row) => <TicketStatusBadge ticket={row} /> },
    { title: t("Ticket:Col:Due"), dataIndex: "dueAt", width: 150, render: (_: unknown, row) => <DueCell ticket={row} /> },
    { title: t("Ticket:Col:LastContact"), key: "lastContact", width: 230, render: (_: unknown, row) => <LastContactCell ticket={row} /> },
    timeColumn(t("Ticket:Col:NextCall"), "nextCallAt"),
    timeColumn(t("Ticket:Col:Appointment"), "appointmentStart"),
    timeColumn(t("Ticket:Col:Received"), "receivedAt"),
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 140,
      align: "center",
      fixed: "right",
      render: (_: unknown, row) => <TicketRowActions ticket={row} rights={context.rights} onAction={context.onAction} />,
    },
  ];
}
