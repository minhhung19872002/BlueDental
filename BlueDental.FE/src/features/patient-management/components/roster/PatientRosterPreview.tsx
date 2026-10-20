import { useMemo, useState } from "react";
import { Alert, Checkbox, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import {
  ROSTER_ROW_ACTION,
  type PatientRosterResultDto,
  type PatientRosterRowDto,
  type RosterRowAction,
} from "../../api/patientRosterApi";

interface Props {
  result: PatientRosterResultDto;
}

const ACTION_TAG: Record<RosterRowAction, { color: string; key: string }> = {
  [ROSTER_ROW_ACTION.Create]: { color: "green", key: "PatientRoster:Action:Create" },
  [ROSTER_ROW_ACTION.Update]: { color: "orange", key: "PatientRoster:Action:Update" },
  [ROSTER_ROW_ACTION.Delete]: { color: "volcano", key: "PatientRoster:Action:Delete" },
  [ROSTER_ROW_ACTION.Error]: { color: "red", key: "PatientRoster:Action:Error" },
};

const TABLE_HEIGHT = 320;

export function rosterSummary(result: PatientRosterResultDto): string {
  return t(
    "PatientRoster:Summary",
    result.totalRows,
    result.unmarked,
    result.created,
    result.updated,
    result.deleted,
    result.errorCount,
  );
}

/** Rows the import will write: added, edited and deleted patients. */
export function rosterChangeCount(result: PatientRosterResultDto): number {
  return result.created + result.updated + result.deleted;
}

/**
 * What the check found for each marked row. Unmarked rows are left alone and
 * only counted. One wrong row refuses the file, so the summary says that first
 * and the table finds every row to fix.
 */
export function PatientRosterPreview({ result }: Props) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const hasErrors = result.errorCount > 0;

  const rows = useMemo(
    () => (onlyErrors ? result.rows.filter((row) => row.errors.length > 0) : result.rows),
    [onlyErrors, result.rows],
  );

  const columns = useMemo<ColumnsType<PatientRosterRowDto>>(
    () => [
      { title: t("Taxonomy:Import:Col:Row"), dataIndex: "row", width: 60 },
      { title: t("PatientRoster:Col:Code"), dataIndex: "patientCode", width: 120, ellipsis: true },
      { title: t("PatientRoster:Col:Name"), dataIndex: "fullName", width: 170, ellipsis: true },
      {
        title: t("Taxonomy:Import:Col:Errors"),
        dataIndex: "errors",
        className: "bd-roster-errcell",
        render: (errors: string[]) => errors.join("; "),
      },
      {
        title: t("Taxonomy:Import:Col:Result"),
        dataIndex: "action",
        width: 96,
        render: (action: RosterRowAction) => (
          <Tag color={ACTION_TAG[action].color}>{t(ACTION_TAG[action].key)}</Tag>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-roster-preview">
      <Alert
        className="bd-roster-summary"
        type={hasErrors ? "error" : "success"}
        showIcon
        message={rosterSummary(result)}
        description={hasErrors ? t("Taxonomy:Import:HasErrors") : t("PatientRoster:ReadyHint")}
      />

      {result.fileErrors.length > 0 && (
        <div className="bd-roster-file-errors">
          <div className="bd-roster-file-errors-title">{t("Taxonomy:Import:FileErrorsTitle")}</div>
          <ul>
            {result.fileErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result.rows.length > 0 && (
        <>
          <div className="bd-roster-filter">
            <Checkbox checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)}>
              {t("Taxonomy:Import:OnlyErrors")}
            </Checkbox>
          </div>
          <Table<PatientRosterRowDto>
            className="bd-roster-table"
            size="small"
            rowKey="row"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 688, y: TABLE_HEIGHT }}
            rowClassName={(row) => (row.errors.length > 0 ? "bd-roster-row--error" : "")}
          />
        </>
      )}
    </div>
  );
}
