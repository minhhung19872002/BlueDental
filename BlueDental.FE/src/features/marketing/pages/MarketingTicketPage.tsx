import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useIsAllBranches } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { useTicketList, useTicketStats, type TicketDto } from "../api/ticketApi";
import { useTicketFile } from "../api/ticketFileApi";
import { useTicketStaffOptions, useTicketTags } from "../api/ticketSupportApi";
import { MarketingShell } from "../components/MarketingShell";
import { ticketColumns } from "../components/ticketColumns";
import { TicketDetailDialog } from "../components/TicketDetailDialog";
import { TicketDialogs } from "../components/TicketDialogs";
import { TicketFilterBar } from "../components/TicketFilterBar";
import { TicketToolbar } from "../components/TicketToolbar";
import { TransferDialog } from "../components/TransferDialog";
import { useSourceOptions } from "../hooks/useSourceOptions";
import { useTicketActions } from "../hooks/useTicketActions";
import { useTicketFilters } from "../hooks/useTicketFilters";
import { useTicketRights } from "../hooks/useTicketRights";
import { useTicketTransfer } from "../hooks/useTicketTransfer";
import "../components/marketing.css";

const rowClassName = (ticket: TicketDto) => (ticket.isOverdue ? "ticket-row ticket-row--overdue" : "ticket-row");

/** Marketing → Ticket (/marketing/tickets). BlueDental-local — docs/clone/pages/marketing-ticket.md. */
export function MarketingTicketPage() {
  const rights = useTicketRights();
  const filters = useTicketFilters();
  const actions = useTicketActions();
  const transfer = useTicketTransfer(filters.filter);
  const allBranches = useIsAllBranches();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useTicketList(filters.query);
  const { data: stats } = useTicketStats(filters.filter);
  const { data: tags = [] } = useTicketTags();
  const sources = useSourceOptions();
  const { data: staffOptions = [] } = useTicketStaffOptions(rights.readAll || rights.rows.transfer);
  // Ticket File is the create leaf's; without it the chip just says "Nhập file".
  const { data: importFile } = useTicketFile(rights.create ? filters.importFileId : undefined);

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
          transfer={
            rights.rows.transfer
              ? { onClick: transfer.show, disabledReason: allBranches ? t("Ticket:TransferBranchHint") : undefined }
              : undefined
          }
          file={
            filters.importFileId
              ? { name: importFile?.fileName ?? t("Ticket:Channel:File"), onClear: filters.clearFile }
              : undefined
          }
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

      <TicketDetailDialog
        ticketId={detailId}
        tags={tagMap}
        sourceName={sources.sourceName}
        rights={rights.rows}
        onAction={actions.onAction}
        onClose={() => setDetailId(null)}
      />
      <TransferDialog
        open={transfer.open}
        matched={data?.totalCount ?? 0}
        staffOptions={staffOptions}
        pending={transfer.pending}
        onSubmit={(assigneeIds) => void transfer.submit(assigneeIds)}
        onClose={transfer.close}
      />
      <TicketDialogs actions={actions} tags={tags} sources={sources} staffOptions={staffOptions} canTransfer={rights.rows.transfer} />
    </MarketingShell>
  );
}
