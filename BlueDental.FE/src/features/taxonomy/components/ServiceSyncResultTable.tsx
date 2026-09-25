import { Table, type TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import type { ServiceCatalogSyncResultDto } from "../api/clinicIntegrationApi";

export type SyncResultTab = "duplicated" | "warned" | "skipped" | "updated";

interface Row {
  key: string;
  code: string | null;
  second: string | null;
  third?: string | null;
  relinked?: boolean;
}

const codeCell = (value: string | null) => <span className="bd-sync-result__mono">{value ?? "—"}</span>;

function rowsFor(tab: SyncResultTab, result: ServiceCatalogSyncResultDto): Row[] {
  switch (tab) {
    case "duplicated":
      return result.duplicated.map((item, index) => ({
        key: item.externalId || String(index),
        code: item.code,
        second: item.dentalName,
        third: item.systemName,
      }));
    case "updated":
      return result.updated.map((item, index) => ({
        key: item.externalId || String(index),
        code: item.code,
        second: item.externalId,
        relinked: item.relinked,
      }));
    default:
      return (tab === "warned" ? result.warned : result.skipped).map((item, index) => ({
        key: item.externalId || String(index),
        code: item.code,
        second: item.reason,
      }));
  }
}

function columnsFor(tab: SyncResultTab): TableColumnsType<Row> {
  const code = { title: t("Taxonomy:Sync:Result:Col:Code"), dataIndex: "code", render: codeCell };

  if (tab === "duplicated") {
    return [
      code,
      { title: t("Taxonomy:Sync:Result:Col:DentalName"), dataIndex: "second" },
      { title: t("Taxonomy:Sync:Result:Col:SystemName"), dataIndex: "third" },
    ];
  }
  if (tab === "updated") {
    return [
      code,
      { title: t("Taxonomy:Sync:Result:Col:DentalCode"), dataIndex: "second", render: codeCell },
      {
        title: t("Taxonomy:Sync:Result:Col:Note"),
        dataIndex: "relinked",
        render: (relinked: boolean | undefined) =>
          relinked ? (
            <span className="bd-sync-result__relinked">{t("Taxonomy:Sync:Result:Relinked")}</span>
          ) : (
            <span className="bd-sync-result__muted">—</span>
          ),
      },
    ];
  }
  return [code, { title: t("Taxonomy:Sync:Result:Col:Reason"), dataIndex: "second" }];
}

/** The list under the result dialog's tabs; one column set per tab, as the reference draws them. */
export function ServiceSyncResultTable({ tab, result }: { tab: SyncResultTab; result: ServiceCatalogSyncResultDto }) {
  return (
    <Table<Row>
      className="bd-sync-result__table"
      size="small"
      rowKey="key"
      pagination={false}
      // The header stays put while a long list scrolls, as the reference's sticky header does.
      scroll={{ y: 280 }}
      columns={columnsFor(tab)}
      dataSource={rowsFor(tab, result)}
      locale={{ emptyText: t("Taxonomy:Sync:Result:Empty") }}
    />
  );
}
