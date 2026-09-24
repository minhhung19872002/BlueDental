import { Alert, Checkbox, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import {
  IMPORT_ROW_ACTION,
  type CatalogImportResultDto,
  type CatalogImportRowDto,
  type CatalogImportSheetDto,
  type ImportRowAction,
} from "../api/taxonomyApi";
import { t } from "@/lib/i18n";

interface Props {
  result: CatalogImportResultDto;
}

const ACTION_TAG: Record<ImportRowAction, { color: string; key: string }> = {
  [IMPORT_ROW_ACTION.Create]: { color: "green", key: "Taxonomy:Import:Action:Create" },
  [IMPORT_ROW_ACTION.Skip]: { color: "default", key: "Taxonomy:Import:Action:Skip" },
  [IMPORT_ROW_ACTION.Restore]: { color: "blue", key: "Taxonomy:Import:Action:Restore" },
  [IMPORT_ROW_ACTION.Line]: { color: "cyan", key: "Taxonomy:Import:Action:Line" },
  [IMPORT_ROW_ACTION.Error]: { color: "red", key: "Taxonomy:Import:Action:Error" },
  [IMPORT_ROW_ACTION.Update]: { color: "orange", key: "Taxonomy:Import:Action:Update" },
};

const ROW_WIDTH = 64;
const VALUE_WIDTH = 160;
const RESULT_WIDTH = 130;
const ERROR_WIDTH = 280;
const TABLE_HEIGHT = 320;

export function importSummary(result: CatalogImportResultDto): string {
  return t(
    "Taxonomy:Import:Summary",
    result.totalRows,
    result.createCount,
    result.updateCount,
    result.restoreCount,
    result.skipCount,
    result.errorCount,
  );
}

/** Rows the import will write: new, changed and brought-back ones. */
export function importableCount(result: CatalogImportResultDto): number {
  return result.createCount + result.updateCount + result.restoreCount;
}

/**
 * What the check found, row by row. The file is refused as a whole when any
 * row is wrong, so the summary says so first and the table lets the user find
 * every row they need to fix before choosing the file again.
 */
export function CatalogImportPreview({ result }: Props) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const hasErrors = result.errorCount > 0;

  return (
    <div className="bd-import-preview">
      <Alert
        className="bd-import-summary"
        type={hasErrors ? "error" : "success"}
        showIcon
        message={importSummary(result)}
        description={hasErrors ? t("Taxonomy:Import:HasErrors") : t("Taxonomy:Import:ReadyHint")}
      />

      {result.newGroups.length > 0 && (
        <p className="bd-import-groups">{t("Taxonomy:Import:NewGroups", result.newGroups.join(", "))}</p>
      )}

      {result.fileErrors.length > 0 && (
        <div className="bd-import-file-errors">
          <div className="bd-import-file-errors-title">{t("Taxonomy:Import:FileErrorsTitle")}</div>
          <ul>
            {result.fileErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result.sheets.length > 0 && (
        <div className="bd-import-filter">
          <Checkbox checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)}>
            {t("Taxonomy:Import:OnlyErrors")}
          </Checkbox>
        </div>
      )}

      {result.sheets.length === 1 && <SheetTable sheet={result.sheets[0]} onlyErrors={onlyErrors} />}
      {result.sheets.length > 1 && (
        <Tabs
          size="small"
          items={result.sheets.map((sheet) => ({
            key: sheet.name,
            label: sheet.name,
            children: <SheetTable sheet={sheet} onlyErrors={onlyErrors} />,
          }))}
        />
      )}
    </div>
  );
}

function SheetTable({ sheet, onlyErrors }: { sheet: CatalogImportSheetDto; onlyErrors: boolean }) {
  const rows = useMemo(
    () => (onlyErrors ? sheet.rows.filter((row) => row.errors.length > 0) : sheet.rows),
    [onlyErrors, sheet.rows],
  );

  const columns = useMemo<ColumnsType<CatalogImportRowDto>>(
    () => [
      { title: t("Taxonomy:Import:Col:Row"), dataIndex: "row", width: ROW_WIDTH, fixed: "left" },
      ...sheet.columns.map((header, index) => ({
        title: header,
        key: header,
        width: VALUE_WIDTH,
        ellipsis: true,
        render: (_: unknown, row: CatalogImportRowDto) => row.values[index] ?? "",
      })),
      {
        title: t("Taxonomy:Import:Col:Errors"),
        dataIndex: "errors",
        width: ERROR_WIDTH,
        className: "bd-import-errcell",
        render: (errors: string[]) => errors.join("; "),
      },
      // Pinned, so the verdict stays in view while the values scroll; a pinned
      // column has to be the last one, hence after the errors.
      {
        title: t("Taxonomy:Import:Col:Result"),
        dataIndex: "action",
        width: RESULT_WIDTH,
        fixed: "right",
        render: (action: ImportRowAction) => (
          <Tag color={ACTION_TAG[action].color}>{t(ACTION_TAG[action].key)}</Tag>
        ),
      },
    ],
    [sheet.columns],
  );

  // Not paged (the file has no size limit) and not virtual either: the
  // virtual body keeps its horizontal offset in React state and hides its own
  // scrollbar, so the app-wide grab-to-scroll and the native bar both miss it
  // (R-542). A plain body scrolls like every other table in the app.
  return (
    <Table<CatalogImportRowDto>
      className="bd-import-table"
      size="small"
      rowKey="row"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: ROW_WIDTH + sheet.columns.length * VALUE_WIDTH + RESULT_WIDTH + ERROR_WIDTH, y: TABLE_HEIGHT }}
      rowClassName={(row) => (row.errors.length > 0 ? "bd-import-row--error" : "")}
    />
  );
}
