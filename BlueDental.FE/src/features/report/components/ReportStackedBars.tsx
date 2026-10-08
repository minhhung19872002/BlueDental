import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { t } from "@/lib/i18n";
import { formatStatValue } from "./ReportStatCards";
import { ChartLegend, type ChartSeries } from "./ReportChartCard";

export interface StackedBarRow {
  name: string;
  [key: string]: number | string;
}

interface Props {
  rows: StackedBarRow[];
  series: ChartSeries[];
  /** Width kept for the category names on the left. */
  labelWidth?: number;
  /** Bars drawn at most; the table under the charts keeps every row. */
  maxRows?: number;
}

const ROW_HEIGHT = 34;
const AXIS_HEIGHT = 28;

const LABEL_FONT = 12;
// Room for the tick offset, plus slack for a web font that loads after the first measure.
const LABEL_GAP = 20;

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Pixel width of `text` in the page font at the label size. */
function textWidth(text: string): number {
  if (measureContext === undefined) {
    measureContext = document.createElement("canvas").getContext("2d");
    if (measureContext) measureContext.font = `${LABEL_FONT}px ${getComputedStyle(document.body).fontFamily}`;
  }
  return measureContext ? measureContext.measureText(text).width : text.length * LABEL_FONT * 0.6;
}

/** `name`, cut with an ellipsis until it fits in `width` pixels. */
function fitLabel(name: string, width: number): string {
  if (textWidth(name) <= width) return name;
  let end = name.length - 1;
  while (end > 1 && textWidth(`${name.slice(0, end)}…`) > width) end--;
  return `${name.slice(0, end).trimEnd()}…`;
}

interface CategoryTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  width: number;
}

/**
 * One line per category: recharts wraps a long name over several lines that
 * run into the next bar, so it is cut to the label width instead and the full
 * name stays in the hover title.
 */
function CategoryTick({ x = 0, y = 0, payload, width }: CategoryTickProps) {
  const name = String(payload?.value ?? "");
  const label = fitLabel(name, width - LABEL_GAP);
  return (
    <text x={Number(x)} y={Number(y)} dx={-4} dy={4} textAnchor="end" fontSize={LABEL_FONT} className="report-chart-tick">
      <title>{name}</title>
      {label}
    </text>
  );
}

function totalOf(row: StackedBarRow, series: ChartSeries[]) {
  return series.reduce((sum, s) => sum + Number(row[s.key] ?? 0), 0);
}

/** Rows as given while they fit; past `maxRows`, the busiest non-empty ones. */
function pickRows(rows: StackedBarRow[], series: ChartSeries[], maxRows: number) {
  if (rows.length <= maxRows) return { shown: rows, hidden: 0 };
  const filled = rows
    .map((row) => ({ row, total: totalOf(row, series) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
  const shown = filled.slice(0, maxRows).map((x) => x.row);
  return { shown, hidden: filled.length - shown.length };
}

/**
 * One horizontal bar per category, split into its status segments. A long
 * list (files, sources) is cut to its busiest `maxRows`, largest first, so the
 * card stays short; the table under the charts keeps every row.
 */
export function ReportStackedBars({ rows, series, labelWidth = 150, maxRows = 8 }: Props) {
  const { shown, hidden } = pickRows(rows, series, maxRows);
  if (shown.every((row) => totalOf(row, series) === 0)) {
    return <div className="report-chart-empty">{t("Common:NoData")}</div>;
  }

  return (
    <>
      <div className="report-chart-body">
        <ResponsiveContainer width="100%" height={shown.length * ROW_HEIGHT + AXIS_HEIGHT}>
          <BarChart data={shown} layout="vertical" barCategoryGap={8} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} className="report-chart-grid" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="name"
              width={labelWidth}
              tickLine={false}
              axisLine={false}
              tick={<CategoryTick width={labelWidth} />}
            />
            <Tooltip cursor={{ className: "report-chart-cursor" }} formatter={(value) => formatStatValue(Number(value), "count")} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="status"
                className={`report-bar report-bar--${s.tone} report-bar--stacked`}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hidden > 0 && <div className="report-chart-more">{t("Report:Chart:MoreInTable", shown.length, hidden)}</div>}
      <ChartLegend series={series} />
    </>
  );
}
