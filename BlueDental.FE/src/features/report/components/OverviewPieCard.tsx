import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from "recharts";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

const RADIAN = Math.PI / 180;

interface Props {
  received: number;
  debt: number;
}

/** Percentage label drawn inside each slice (the reference prints "34.72%" in the wedge). */
function renderSliceLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const inner = Number(props.innerRadius ?? 0);
  const outer = Number(props.outerRadius ?? 0);
  const angle = props.midAngle ?? 0;
  const percent = props.percent ?? 0;
  if (percent === 0) return null;
  const radius = inner + (outer - inner) * 0.55;
  const x = cx + radius * Math.cos(-angle * RADIAN);
  const y = cy + radius * Math.sin(-angle * RADIAN);
  return (
    <text x={x} y={y} className="report-pie-label" textAnchor="middle" dominantBaseline="central">
      {(percent * 100).toFixed(2)}%
    </text>
  );
}

export function OverviewPieCard({ received, debt }: Props) {
  const slices = [
    { name: t("Thực thu"), value: received, tone: "green" },
    { name: t("Công nợ"), value: debt, tone: "red" },
  ];
  const isEmpty = received + debt === 0;

  return (
    <div className="reception-card reception-card--content report-pie-card">
      <div className="report-summary-card-title">{t("Thực thu và công nợ")}</div>
      <div className="report-pie-section">
        <div className="report-pie-chart">
          {isEmpty ? (
            <div className="report-pie-empty">{t("Không có dữ liệu")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  labelLine={false}
                  label={renderSliceLabel}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} className={`report-pie-slice report-pie-slice--${s.tone}`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${formatVND(Number(value))} đ`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="report-pie-legend">
          {slices.map((s) => (
            <li key={s.name} className="report-pie-legend-item">
              <span className={`report-pie-legend-dot report-pie-legend-dot--${s.tone}`} />
              <span>{s.name}</span>
              <span className="report-pie-legend-value">{formatVND(s.value)} đ</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
