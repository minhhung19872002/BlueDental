import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { useTicketList, useTicketStats, type TicketDto } from "../api/ticketApi";
import { useTicketStaffOptions, useTicketTags } from "../api/ticketSupportApi";
import { MarketingShell } from "../components/MarketingShell";
import { ticketColumns } from "../components/ticketColumns";
import { TicketDetailDrawer } from "../components/TicketDetailDrawer";
import { TicketDialogs } from "../components/TicketDialogs";
import { TicketFilterBar } from "../components/TicketFilterBar";
import { TicketToolbar } from "../components/TicketToolbar";
import { useSourceOptions } from "../hooks/useSourceOptions";
import { useTicketActions } from "../hooks/useTicketActions";
import { useTicketFilters } from "../hooks/useTicketFilters";
import { useTicketRights } from "../hooks/useTicketRights";
import "../components/marketing.css";

const rowClassName = (ticket: TicketDto) => (ticket.isOverdue ? "ticket-row ticket-row--overdue" : "ticket-row");

/** Marketing → Ticket (/marketing/tickets). BlueDental-local — docs/clone/pages/marketing-ticket.md. */
export function MarketingTicketPage() {
  const rights = useTicketRights();
  const filters = useTicketFilters();
  const actions = useTicketActions();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useTicketList(filters.query);
  const { data: stats } = useTicketStats(filters.filter);
  const { data: tags = [] } = useTicketTags();
  const sources = useSourceOptions();
  const { data: staffOptions = [] } = useTicketStaffOptions(rights.readAll || rights.rows.transfer);

  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const tagOptions = useMemo(() => tags.map((tag) => ({ value: tag.id, label: tag.name })), [tags]);
  const columns = ticketColumns({ tags: tagMap, sourceName: sources.sourceName, rights: rights.rows, onAction: actions.onAction });

  const handleRow = (ticket: TicketDto) => ({ onClick: () => setDetailId(ticket.id) });

  return (
    <MarketingShell activeKey="tickets" subtitle="Ticket:PageSubtitle">
      <div className="bd-cat-header mkt-header">
        <TicketToolbar
          state={filters.state}
          onChange={filters.patch}
          onCreate={rights.create ? actions.openCreate : undefined}
        />
        <TicketFilterBar
          state={filters.state}
          stats={stats}
          onChange={filters.patch}
          isFiltered={filters.isFiltered}
          onReset={filters.reset}
          tagOptions={tagOptions}
          sourceOptions={sources.groupOptions}
          staffOptions={rights.readAll ? staffOptions : undefined}
        />
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<TicketDto>
            columns={columns}
            dataSource={data?.items ?? []}
            rowKey="id"
            loading={isLoading}
            onRow={handleRow}
            rowClassName={rowClassName}
            locale={{ emptyText: t(filters.isFiltered ? "Ticket:EmptyFiltered" : "Ticket:Empty") }}
            pagination={filters.pagination.buildConfig(data?.totalCount ?? 0, countedTotal(t("Ticket:Noun")))}
          />
        </div>
      </div>

      <TicketDetailDrawer
        ticketId={detailId}
        tags={tagMap}
        sourceName={sources.sourceName}
        rights={rights.rows}
        onAction={actions.onAction}
        onClose={() => setDetailId(null)}
      />
      <TicketDialogs actions={actions} tags={tags} sources={sources} staffOptions={staffOptions} canTransfer={rights.rows.transfer} />
    </MarketingShell>
  );
}
