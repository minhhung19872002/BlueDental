import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatVND } from "@/utils/format";
import type { MonthlyPointVm, OverviewRowVm } from "../types/mock";
import type { StatTone } from "./ReportStatCards";

export interface OverviewSeriesConfig {
  key: "a" | "b" | "c";
  label: () => string;
  tone: StatTone;
}

interface Props {
  title: string;
  rows: OverviewRowVm[];
  series: MonthlyPointVm[];
  config: OverviewSeriesConfig[];
  /** Values are money ("1.300.000 đ / 450.000 đ") instead of plain counts. */
  money?: boolean;
}

function formatValue(value: number, money: boolean) {
  return money ? `${formatVND(value)} đ` : String(value);
}

/** "Thông tin lượt khách / lịch hẹn / thanh toán / thu chi" card: rows + monthly bars + legend. */
export function OverviewCard({ title, rows, series, config, money = false }: Props) {
  return (
    <div className="reception-card reception-card--content report-summary-card">
      <div className="report-summary-card-title">{title}</div>

      <div className="report-summary-rows">
        {rows.map((row) => (
          <div key={row.label} className="report-summary-row">
            <span className="report-summary-row-label">{row.label}</span>
            <span className="report-summary-row-value">
              {row.values.map((value, index) => (
                <span key={index} className={`report-money report-money--${config[index]?.tone ?? "ink"}`}>
                  {index > 0 && <span className="report-summary-sep"> / </span>}
                  {formatValue(value, money)}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="report-mini-chart">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={series} barGap={2} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis hide />
            <Tooltip formatter={(value) => formatValue(Number(value), money)} />
            {config.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label()}
                className={`report-bar report-bar--${s.tone}`}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="report-pie-legend report-pie-legend--inline">
        {config.map((s) => (
          <li key={s.key} className="report-pie-legend-item">
            <span className={`report-pie-legend-dot report-pie-legend-dot--${s.tone}`} />
            <span>{s.label()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
