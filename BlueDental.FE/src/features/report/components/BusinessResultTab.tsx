import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useMockBusinessResult, type RangeQuery } from "../api/reportMockQueries";
import type { BusinessResultVm } from "../types/mock";
import type { StatTone } from "./ReportStatCards";

interface ResultRow {
  key: keyof BusinessResultVm;
  label: () => string;
  tone: StatTone | "signed";
  variant?: "sub" | "total";
}

/** Same order as the reference: total, its two parts (indented), refund, expense, result. */
const RESULT_ROWS: ResultRow[] = [
  { key: "totalRevenue", label: () => t("Doanh thu tổng"), tone: "green" },
  { key: "treatmentIncome", label: () => t("Thu từ dịch vụ điều trị"), tone: "ink", variant: "sub" },
  { key: "otherIncome", label: () => t("Thu khác"), tone: "ink", variant: "sub" },
  { key: "treatmentRefund", label: () => t("Hoàn tiền từ dịch vụ điều trị"), tone: "red" },
  { key: "expense", label: () => t("Chi phí"), tone: "red" },
  { key: "result", label: () => t("Kết quả kinh doanh"), tone: "signed", variant: "total" },
];

function resolveTone(row: ResultRow, value: number): StatTone {
  if (row.tone !== "signed") return row.tone;
  return value >= 0 ? "green" : "red";
}

/** Tab "Kết quả kinh doanh": a bordered list of rows; no doctor filter and no export on the reference. */
export function BusinessResultTab(range: RangeQuery) {
  const { data, isLoading } = useMockBusinessResult(range);

  if (isLoading || !data) {
    return (
      <div className="report-tab report-overview-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="report-tab">
      <div className="report-result-list">
        {RESULT_ROWS.map((row) => {
          const value = data[row.key];
          const className = ["report-result-row", row.variant && `report-result-row--${row.variant}`]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={row.key} className={className}>
              <span className="report-result-label">{row.label()}</span>
              <span className={`report-result-value report-money report-money--${resolveTone(row, value)}`}>
                {formatVND(value)} đ
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
