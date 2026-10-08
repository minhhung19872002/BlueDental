import type { ReactNode } from "react";
import type { StatTone } from "./ReportStatCards";

/** One coloured series of a report chart; the key names a numeric field of each row. */
export interface ChartSeries<K extends string = string> {
  key: K;
  label: string;
  tone: StatTone;
}

interface LegendProps {
  series: ChartSeries[];
}

/** Dot + label row under a chart (same markup as the tab-1 overview cards). */
export function ChartLegend({ series }: LegendProps) {
  return (
    <ul className="report-pie-legend report-pie-legend--inline">
      {series.map((s) => (
        <li key={s.key} className="report-pie-legend-item">
          <span className={`report-pie-legend-dot report-pie-legend-dot--${s.tone}`} />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  title: string;
  /** Sits at the right of the title, e.g. a count or a hint. */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Bordered white card with a bold title, the frame every report chart sits in. */
export function ReportChartCard({ title, extra, className, children }: Props) {
  return (
    <div className={["reception-card reception-card--content report-chart-card", className].filter(Boolean).join(" ")}>
      <div className="report-chart-card-head">
        <div className="report-summary-card-title">{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}
