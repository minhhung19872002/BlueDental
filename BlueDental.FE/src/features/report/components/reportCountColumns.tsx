import { Progress } from "antd";
import type { ColumnType } from "antd/es/table";
import { formatStatValue, type StatTone } from "./ReportStatCards";

/** Right-aligned count; a zero stays grey so the non-zero cells stand out. */
export function countColumn<T extends object>(key: keyof T & string, title: string, tone?: StatTone): ColumnType<T> {
  return {
    key,
    dataIndex: key,
    title,
    align: "right",
    width: 110,
    render: (value: number) => (
      <span className={value === 0 ? "report-count report-count--zero" : `report-count report-money--${tone ?? "ink"}`}>
        {formatStatValue(value, "count")}
      </span>
    ),
  };
}

/** Share of the row that reached the goal, as a thin bar plus the figure. */
export function rateColumn<T extends object>(title: string, rate: (row: T) => number): ColumnType<T> {
  return {
    key: "rate",
    title,
    width: 170,
    render: (_: unknown, row: T) => {
      const value = rate(row);
      return (
        <div className="report-rate-cell">
          <Progress percent={value} showInfo={false} size="small" className="report-rate-bar" />
          <span className="report-rate-value">{formatStatValue(value, "percent")}</span>
        </div>
      );
    },
  };
}

/** Rounded to one decimal like the Excel export; 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((1000 * part) / whole) / 10;
}
