import { useMemo, useState } from "react";
import { Alert, Checkbox, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import {
  STAGE_COLUMNS,
  stageHeader,
  type StageImportAction,
  type StageImportLine,
  type StageImportPlan,
  type StageSheet,
} from "../stageExcel";
import { stageFileProblemText, stageProblemText, stageSheetWords } from "../stageExcelWords";

interface Props {
  sheet: StageSheet;
  plan: StageImportPlan;
}

/** The catalog import's tags, plus the two only a stage list has. */
const ACTION_TAG: Record<StageImportAction, { color: string; key: string }> = {
  Create: { color: "green", key: "Taxonomy:Import:Action:Create" },
  Update: { color: "orange", key: "Taxonomy:Import:Action:Update" },
  Same: { color: "default", key: "Taxonomy:Service:StageExcel:Action:Same" },
  Remove: { color: "volcano", key: "Taxonomy:Service:StageExcel:Action:Remove" },
  Error: { color: "red", key: "Taxonomy:Import:Action:Error" },
};

const ROW_WIDTH = 64;
const VALUE_WIDTHS = [220, 80, 120, 150];
const ERROR_WIDTH = 260;
const RESULT_WIDTH = 120;
const TABLE_HEIGHT = 320;

export function stageImportSummary(plan: StageImportPlan): string {
  const { Create, Update, Same, Error } = plan.counts;
  return t("Taxonomy:Service:StageExcel:Summary", Create + Update + Same + Error, Create, Update, Same, Error);
}

/** What the check found, row by row, in the catalog import's layout. */
export function ServiceStageImportPreview({ sheet, plan }: Props) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const hasErrors = plan.next === null;
  const words = useMemo(stageSheetWords, []);

  const lines = useMemo(
    () => (onlyErrors ? plan.lines.filter((line) => line.action === "Error") : plan.lines),
    [onlyErrors, plan.lines],
  );

  const columns = useMemo<ColumnsType<StageImportLine>>(
    () => [
      {
        title: t("Taxonomy:Import:Col:Row"),
        dataIndex: "row",
        width: ROW_WIDTH,
        fixed: "left",
        render: (row: number | null) => row ?? "—",
      },
      ...STAGE_COLUMNS.map((column, index) => ({
        title: stageHeader(column, words.headers),
        key: column,
        width: VALUE_WIDTHS[index],
        ellipsis: true,
        render: (_: unknown, line: StageImportLine) => line.values[index],
      })),
      {
        title: t("Taxonomy:Import:Col:Errors"),
        dataIndex: "problems",
        width: ERROR_WIDTH,
        className: "bd-import-errcell",
        render: (problems: StageImportLine["problems"]) => problems.map(stageProblemText).join("; "),
      },
      {
        title: t("Taxonomy:Import:Col:Result"),
        dataIndex: "action",
        width: RESULT_WIDTH,
        fixed: "right",
        render: (action: StageImportAction) => (
          <Tag color={ACTION_TAG[action].color}>{t(ACTION_TAG[action].key)}</Tag>
        ),
      },
    ],
    [words],
  );

  return (
    <div className="bd-import-preview">
      <Alert
        className="bd-import-summary"
        type={hasErrors ? "error" : "success"}
        showIcon
        message={stageImportSummary(plan)}
        description={hasErrors ? t("Taxonomy:Import:HasErrors") : t("Taxonomy:Service:StageExcel:ReadyHint")}
      />

      {plan.removedCount > 0 && (
        <Alert
          className="bd-import-summary"
          type="warning"
          showIcon
          message={t("Taxonomy:Service:StageExcel:Removes", plan.removedCount)}
        />
      )}

      {sheet.fileProblem && (
        <div className="bd-import-file-errors">
          <div className="bd-import-file-errors-title">{t("Taxonomy:Import:FileErrorsTitle")}</div>
          <ul>
            <li>{stageFileProblemText(sheet.fileProblem, words)}</li>
          </ul>
        </div>
      )}

      {plan.lines.length > 0 && (
        <>
          <div className="bd-import-filter">
            <Checkbox checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)}>
              {t("Taxonomy:Import:OnlyErrors")}
            </Checkbox>
          </div>
          <Table<StageImportLine>
            className="bd-import-table"
            size="small"
            rowKey="key"
            columns={columns}
            dataSource={lines}
            pagination={false}
            scroll={{
              x: ROW_WIDTH + VALUE_WIDTHS.reduce((sum, width) => sum + width, 0) + ERROR_WIDTH + RESULT_WIDTH,
              y: TABLE_HEIGHT,
            }}
            rowClassName={(line) => (line.action === "Error" ? "bd-import-row--error" : "")}
          />
        </>
      )}
    </div>
  );
}
