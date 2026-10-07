import { Alert, Result, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import type { TicketImportResult as ImportOutcome, TicketImportRowError } from "../api/ticketFileApi";

const errorColumns = (): ColumnsType<TicketImportRowError> => [
  { title: t("Ticket:Import:Row"), dataIndex: "row", key: "row", width: 80, align: "right" },
  {
    title: t("Ticket:Import:Errors"),
    key: "errors",
    render: (_, error) => (
      <ul className="mkt-import-errors">
        {error.errors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    ),
  },
];

/** The last step: what the file became, or — the file being refused whole — the rows to fix first. */
export function TicketImportResult({ result }: { result: ImportOutcome }) {
  if (result.committed) {
    return (
      <Result
        status="success"
        title={t("Ticket:Import:DoneTitle")}
        subTitle={t("Ticket:Import:DoneSummary", result.createdCount, result.reoccurredCount)}
      />
    );
  }

  return (
    <>
      <Alert
        type="error"
        showIcon
        className="mkt-import-alert"
        message={t("Ticket:Import:Rejected")}
        description={t("Ticket:Import:RejectedHint", result.errors.length)}
      />
      <Table<TicketImportRowError>
        className="mkt-import-table"
        size="small"
        rowKey="row"
        columns={errorColumns()}
        dataSource={result.errors}
        pagination={false}
        scroll={{ y: 320 }}
      />
    </>
  );
}
