import { Button, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import { RollbackOutlined, SearchOutlined } from "@ant-design/icons";
import { ActionTooltip } from "@/components/ActionTooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { useTicketList, type TicketDto } from "../api/ticketApi";
import { MarketingShell } from "../components/MarketingShell";
import { CustomerCell, EmptyCell } from "../components/TicketCells";
import { formatTicketTime } from "../components/ticketConfig";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { useTicketActions } from "../hooks/useTicketActions";
import { useTicketFilters } from "../hooks/useTicketFilters";
import "../components/marketing.css";

function deletedColumns(onRestore: (ticket: TicketDto) => void, restoring: boolean): ColumnsType<TicketDto> {
  return [
    { title: t("Ticket:Col:Code"), dataIndex: "code", key: "code", width: 110 },
    { title: t("Ticket:Col:Customer"), key: "customer", width: 220, render: (_, ticket) => <CustomerCell ticket={ticket} /> },
    { title: t("Common:Status"), key: "status", width: 150, render: (_, ticket) => <TicketStatusBadge ticket={ticket} /> },
    { title: t("Ticket:Field:DeleteReason"), dataIndex: "deleteReason", key: "reason", width: 280 },
    {
      title: t("Ticket:Col:DeletedAt"),
      key: "deletedAt",
      width: 200,
      render: (_, ticket) => (
        <div className="mkt-cell">
          <p className="bd-cat-name">{formatTicketTime(ticket.deletionTime) ?? <EmptyCell />}</p>
          {ticket.deleterName && <p className="bd-cat-subtle">{ticket.deleterName}</p>}
        </div>
      ),
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, ticket) => (
        <div className="bd-cat-rowactions">
          <ActionTooltip className="mkt-tip" title={t("Ticket:Restore")}>
            <Button
              type="text"
              size="small"
              aria-label={t("Ticket:Restore")}
              icon={<RollbackOutlined />}
              disabled={restoring}
              onClick={() => onRestore(ticket)}
            />
          </ActionTooltip>
        </div>
      ),
    },
  ];
}

/**
 * Marketing → Đã xoá (/marketing/deleted): deleted tickets with why and by whom,
 * and Khôi phục (asked first). A ticket whose phone has opened a new one since
 * comes back refused (MarketingTicket:0009) — the newer ticket wins.
 */
export function MarketingDeletedPage() {
  const filters = useTicketFilters({ deleted: true });
  const actions = useTicketActions();
  const { data, isLoading } = useTicketList(filters.query);
  const restoring = actions.pending.kind === "restore" ? actions.pending.ticket : null;

  return (
    <MarketingShell activeKey="deleted" subtitle="Ticket:Deleted:PageSubtitle">
      <div className="bd-cat-header mkt-header">
        <div className="bd-cat-headrow">
          <Input
            className="bd-cat-search"
            prefix={<SearchOutlined />}
            placeholder={t("Ticket:SearchPlaceholder")}
            aria-label={t("Ticket:SearchPlaceholder")}
            value={filters.state.keyword}
            maxLength={100}
            allowClear
            onChange={(e) => filters.patch({ keyword: e.target.value })}
          />
        </div>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<TicketDto>
            columns={deletedColumns(actions.restore, actions.busy.restore)}
            dataSource={data?.items ?? []}
            rowKey="id"
            loading={isLoading}
            locale={{ emptyText: t(filters.state.keyword ? "Common:NoResultsMatch" : "Ticket:Deleted:Empty") }}
            pagination={filters.pagination.buildConfig(data?.totalCount ?? 0, countedTotal(t("Ticket:Noun")))}
          />
        </div>
      </div>

      <ConfirmDialog
        open={restoring !== null}
        title={t("Ticket:RestoreTitle")}
        message={restoring ? t("Ticket:RestoreConfirm", restoring.code, restoring.fullName) : ""}
        confirmLabel={t("Ticket:Restore")}
        cancelLabel={t("Common:Close")}
        pending={actions.busy.restore}
        onConfirm={actions.submitRestore}
        onClose={actions.close}
      />
    </MarketingShell>
  );
}
