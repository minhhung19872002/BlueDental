import { useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import type { WorkLogRow } from "../api/operationReportApi";
import { ACTION_LABELS } from "./WorkLogReport";
import { formatMoney } from "./formatMoney";
import { DataTable } from "@/components/DataTable";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

interface Props {
  rows: WorkLogRow[];
  loading: boolean;
  totalCount: number;
  pagination: TablePagination;
  /** Divisions differ over whether the pager names what it counts. */
  showTotal: (total: number, shown: [number, number]) => string;
}

/** `--:--` where a step has not been reached, exactly as the reference shows it. */
function clockOf(value: string | null | undefined): string {
  if (!value) return "--:--";

  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * How many rows each cell has to span.
 *
 * The first row of a block carries the span and the rest carry zero, which is
 * how a table drops a cell entirely. Computed over the page as it arrives:
 * the server pages by item, so a block can be cut in half by a page boundary
 * and the spans have to follow what is actually on screen.
 */
function spansOf(rows: WorkLogRow[]) {
  const visit = new Array<number>(rows.length).fill(0);
  const action = new Array<number>(rows.length).fill(0);

  let visitStart = 0;
  let actionStart = 0;

  rows.forEach((row, index) => {
    const newVisit = index === 0 || row.visitKey !== rows[index - 1].visitKey;
    const newAction = newVisit || row.action !== rows[index - 1].action;

    if (newVisit) visitStart = index;
    if (newAction) actionStart = index;

    visit[visitStart] += 1;
    action[actionStart] += 1;
  });

  return { visit, action };
}

/**
 * The Báo cáo table: one block per visit, one group per action inside it.
 */
export function WorkLogTable({ rows, loading, totalCount, pagination, showTotal }: Props) {
  const spans = useMemo(() => spansOf(rows), [rows]);
  const indexOf = useMemo(
    () => new Map(rows.map((row, index) => [row, index] as const)),
    [rows],
  );

  const columns = useMemo<ColumnsType<WorkLogRow>>(
    () => [
      {
        key: "visit",
        title: t("Ngày / Khách hàng"),
        width: 260,
        onCell: (row) => ({ rowSpan: spans.visit[indexOf.get(row) ?? 0] }),
        render: (_, row) => (
          <div className="bd-ops-visit">
            <span className="bd-cat-num">{formatDate(row.visitDate)}</span>
            <span className="bd-ops-patient-name">
              [{row.patientCode}] - {row.patientName}
            </span>

            {/* Đã đến → Đang khám → Hoàn tất, with the time under each. */}
            <ol className="bd-ops-steps">
              {[
                { label: t("Đã đến"), at: row.arrivedAt },
                { label: t("Đang khám"), at: row.startedAt },
                { label: t("Hoàn tất"), at: row.completedAt },
              ].map((step, index) => (
                <li key={step.label} className="bd-ops-step">
                  <span
                    className={`bd-ops-step-dot${step.at ? " bd-ops-step-dot--done" : ""}`}
                  >
                    {index + 1}
                  </span>
                  <span className="bd-ops-step-label">{step.label}</span>
                  <span className="bd-ops-step-time">{clockOf(step.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        ),
      },
      {
        key: "staff",
        title: t("Nhân sự"),
        width: 170,
        render: (_, row) => row.staffName || "",
      },
      {
        key: "action",
        title: t("Hành động"),
        width: 200,
        onCell: (row) => ({ rowSpan: spans.action[indexOf.get(row) ?? 0] }),
        render: (_, row) => {
          const count = spans.action[indexOf.get(row) ?? 0];
          return (
            <span className="bd-ops-action">
              {t(ACTION_LABELS[row.action])} ({count})
            </span>
          );
        },
      },
      {
        key: "subject",
        title: t("Điều trị / Dịch vụ / Lịch hẹn"),
        render: (_, row) => (
          <span className="bd-ops-subject">
            <span>{row.subject || t("(Trống)")}</span>
            {row.subjectDetail ? (
              <span className="bd-ops-subject-detail">{row.subjectDetail}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: "note",
        title: t("Nội dung / Ghi chú"),
        render: (_, row) => (
          <span className={row.note ? undefined : "bd-ops-blank"}>
            {row.note || t("(Trống)")}
          </span>
        ),
      },
      {
        key: "amount",
        title: t("Doanh số"),
        width: 150,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">
            {row.amount === 0 ? <span className="bd-ops-blank">---</span> : formatMoney(row.amount)}
          </span>
        ),
      },
    ],
    [spans, indexOf],
  );

  return (
    <div className="bd-cat-card">
      <DataTable<WorkLogRow>
        className="bd-ops-worklog"
        columns={columns}
        dataSource={rows}
        rowKey={(row) => `${row.visitKey}-${row.action}-${row.occurredAt}-${row.subject}`}
        loading={loading}
        pagination={pagination.buildConfig(totalCount, showTotal)}
        locale={{ emptyText: t("Không có dữ liệu") }}
      />
    </div>
  );
}
