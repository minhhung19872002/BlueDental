import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Tooltip } from "antd";
import { DownloadOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useIsAllBranches } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { useTicketFileCommands, useTicketFiles, type TicketImportFileDto } from "../api/ticketFileApi";
import { useTicketStaffOptions, useTicketTags } from "../api/ticketSupportApi";
import { MarketingShell } from "../components/MarketingShell";
import { ticketFileColumns } from "../components/ticketFileColumns";
import { TicketImportDialog } from "../components/TicketImportDialog";
import { useSourceOptions } from "../hooks/useSourceOptions";
import { useTicketRights } from "../hooks/useTicketRights";
import "../components/marketing.css";

/**
 * Marketing → Ticket File (/marketing/files, BA 8.4): every imported file with
 * how far its tickets got; a row opens the Ticket list narrowed to that file.
 */
export function MarketingFilePage() {
  const navigate = useNavigate();
  const rights = useTicketRights();
  const allBranches = useIsAllBranches();
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [importing, setImporting] = useState(false);
  const filter = useDebounce(keyword, 400);

  const { data, isLoading } = useTicketFiles({ filter, skipCount: pagination.skipCount, maxResultCount: pagination.maxResultCount });
  const { template } = useTicketFileCommands();
  const { data: tags = [] } = useTicketTags();
  const sources = useSourceOptions();
  const { data: staffOptions = [] } = useTicketStaffOptions(rights.rows.transfer);

  const branchHint = allBranches ? t("Ticket:File:BranchHint") : undefined;
  const openFile = (file: TicketImportFileDto) => navigate(`/marketing/tickets?file=${file.id}`);

  const handleSearch = (value: string) => {
    setKeyword(value);
    pagination.resetToFirstPage();
  };

  return (
    <MarketingShell activeKey="files" subtitle="Ticket:File:PageSubtitle">
      <div className="bd-cat-header mkt-header">
        <div className="bd-cat-headrow">
          <Input
            className="bd-cat-search"
            prefix={<SearchOutlined />}
            placeholder={t("Ticket:File:Search")}
            aria-label={t("Ticket:File:Search")}
            value={keyword}
            maxLength={100}
            allowClear
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="mkt-headgroup">
            <Button
              icon={<DownloadOutlined />}
              loading={template.isPending}
              onClick={() => template.mutate(`${t("Ticket:File:TemplateName")}.xlsx`)}
            >
              {t("Ticket:File:Template")}
            </Button>
            <Tooltip title={branchHint}>
              <Button type="primary" icon={<UploadOutlined />} disabled={allBranches} onClick={() => setImporting(true)}>
                {t("Ticket:File:Import")}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<TicketImportFileDto>
            columns={ticketFileColumns(openFile)}
            dataSource={data?.items ?? []}
            rowKey="id"
            loading={isLoading}
            onRow={(file) => ({ onClick: () => openFile(file) })}
            rowClassName={() => "mkt-file-row"}
            locale={{ emptyText: t(filter ? "Common:NoResultsMatch" : "Ticket:File:Empty") }}
            pagination={pagination.buildConfig(data?.totalCount ?? 0, countedTotal(t("Ticket:File:Noun")))}
          />
        </div>
      </div>

      <TicketImportDialog
        open={importing}
        tags={tags}
        sources={sources}
        staffOptions={rights.rows.transfer ? staffOptions : undefined}
        onClose={() => setImporting(false)}
      />
    </MarketingShell>
  );
}
