import { Fragment } from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import {
  useBusinessResult,
  type BusinessResultCategoryDto,
  type BusinessResultDto,
  type RangeQuery,
} from "../api/clinicReportApi";
import type { StatTone } from "./ReportStatCards";

type AmountKey = {
  [K in keyof BusinessResultDto]: BusinessResultDto[K] extends number ? K : never;
}[keyof BusinessResultDto];

type BreakdownKey = "otherIncomeByCategory" | "expenseByCategory";

interface ResultRow {
  key: AmountKey;
  label: () => string;
  tone: StatTone | "signed";
  variant?: "sub" | "total";
  /** Category rows the reference lists right under this one (tab 3, `taxonomy`). */
  breakdown?: BreakdownKey;
}

/** Same order as the reference: total, its two parts (indented), refund, expense, result. */
const RESULT_ROWS: ResultRow[] = [
  { key: "totalRevenue", label: () => t("Report:BusinessResult:TotalRevenue"), tone: "green" },
  { key: "treatmentIncome", label: () => t("Report:BusinessResult:TreatmentIncome"), tone: "ink", variant: "sub" },
  { key: "otherIncome", label: () => t("Report:BusinessResult:OtherIncome"), tone: "ink", variant: "sub", breakdown: "otherIncomeByCategory" },
  { key: "treatmentRefund", label: () => t("Report:BusinessResult:TreatmentRefund"), tone: "red" },
  { key: "expense", label: () => t("Report:BusinessResult:Expense"), tone: "red", breakdown: "expenseByCategory" },
  { key: "result", label: () => t("Report:BusinessResult:Result"), tone: "signed", variant: "total" },
];

function resolveTone(row: ResultRow, result: number): StatTone {
  if (row.tone !== "signed") return row.tone;
  return result >= 0 ? "green" : "red";
}

function rowClassName(row: ResultRow): string {
  return ["report-result-row", row.variant && `report-result-row--${row.variant}`].filter(Boolean).join(" ");
}

function CategoryRow({ item, tone }: { item: BusinessResultCategoryDto; tone: StatTone }) {
  return (
    <li className="report-result-row report-result-row--category">
      <span className="report-result-label">{item.name}</span>
      <span className={`report-result-value report-money report-money--${tone}`}>{formatMoneyUnit(item.amount)}</span>
    </li>
  );
}

/** Tab "Kết quả kinh doanh": the reference's bordered `<ul>` of rows; no doctor filter and no export. */
export function BusinessResultTab(range: RangeQuery) {
  const { data, isLoading } = useBusinessResult(range);

  if (isLoading || !data) {
    return (
      <div className="report-tab report-overview-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="report-tab">
      <ul className="report-result-list">
        {RESULT_ROWS.map((row) => {
          const tone = resolveTone(row, data.result);
          const breakdown = row.breakdown ? data[row.breakdown] : [];
          return (
            <Fragment key={row.key}>
              <li className={rowClassName(row)}>
                <span className="report-result-label">{row.label()}</span>
                <span className={`report-result-value report-money report-money--${tone}`}>
                  {formatMoneyUnit(data[row.key])}
                </span>
              </li>
              {breakdown.map((item) => (
                <CategoryRow key={item.categoryId} item={item} tone={tone} />
              ))}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
