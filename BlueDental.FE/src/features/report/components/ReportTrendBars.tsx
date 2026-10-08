import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatStatValue } from "./ReportStatCards";
import { ChartLegend, type ChartSeries } from "./ReportChartCard";

export interface TrendPoint {
  label: string;
  [key: string]: number | string;
}

interface Props {
  points: TrendPoint[];
  series: ChartSeries[];
}

/** Grouped bars over the period (days of a week/month, months of a year). */
export function ReportTrendBars({ points, series }: Props) {
  return (
    <>
      <div className="report-chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={points} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} className="report-chart-grid" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip cursor={{ className: "report-chart-cursor" }} formatter={(value) => formatStatValue(Number(value), "count")} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                maxBarSize={18}
                className={`report-bar report-bar--${s.tone}`}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend series={series} />
    </>
  );
}
