import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { t } from "@/lib/i18n";
import { formatStatValue, type StatTone } from "./ReportStatCards";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  tone: StatTone;
}

interface Props {
  slices: DonutSlice[];
  /** Caption under the total in the hole ("Tổng ticket"). */
  centerLabel: string;
}

function percentOf(value: number, total: number) {
  return total === 0 ? 0 : (100 * value) / total;
}

/**
 * Count donut with the total in its hole and a legend that carries every
 * slice's count and share, so the numbers never depend on the colour alone.
 */
export function ReportDonut({ slices, centerLabel }: Props) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  // A lone slice is the whole ring: no gap, no seam where it meets itself.
  const solo = slices.filter((s) => s.value > 0).length === 1;

  return (
    <div className={solo ? "report-donut report-donut--solo" : "report-donut"}>
      <div className="report-donut-chart">
        {total === 0 ? (
          <div className="report-chart-empty">{t("Common:NoData")}</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={solo ? 0 : 1}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} className={`report-fill report-fill--${s.tone}`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatStatValue(Number(value), "count")} />
              </PieChart>
            </ResponsiveContainer>
            <div className="report-donut-center">
              <span className="report-donut-total">{formatStatValue(total, "count")}</span>
              <span className="report-donut-caption">{centerLabel}</span>
            </div>
          </>
        )}
      </div>
      <ul className="report-donut-legend">
        {slices.map((s) => (
          <li key={s.key} className="report-pie-legend-item">
            <span className={`report-pie-legend-dot report-pie-legend-dot--${s.tone}`} />
            <span>{s.label}</span>
            <span className="report-pie-legend-value">
              {formatStatValue(s.value, "count")}
              <span className="report-donut-share">{formatStatValue(percentOf(s.value, total), "percent")}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
