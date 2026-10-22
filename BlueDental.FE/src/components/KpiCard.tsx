import type { CSSProperties, ReactNode } from "react";
import { Spin } from "antd";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  /** Accent for the icon chip; its tint is derived from it. */
  color: string;
  loading?: boolean;
}

/**
 * The design's KPI tile: label, accented icon chip, big figure, caption.
 * Shared by Tổng quan and Thống kê CSKH, both laid out on `.kpi-grid`.
 */
export function KpiCard({ label, value, sub, icon, color, loading }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        <span className="kpi-card-label">{label}</span>
        <span className="kpi-card-icon" style={{ "--kpi-accent": color } as CSSProperties}>
          {icon}
        </span>
      </div>
      {loading ? <Spin size="small" className="kpi-card-spin" /> : <div className="kpi-card-value">{value}</div>}
      {sub !== undefined && <div className="kpi-card-sub">{sub}</div>}
    </div>
  );
}
