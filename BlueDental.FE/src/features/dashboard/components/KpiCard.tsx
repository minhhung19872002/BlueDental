import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  /** Accent for the icon chip; its tint is derived from it. */
  color: string;
  loading?: boolean;
}

/** The design's KPI tile: label, accented icon chip, big figure, caption. */
export function KpiCard({ label, value, sub, icon, color, loading }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        <span className="kpi-card-label">{label}</span>
        <span
          className="kpi-card-icon"
          style={{ background: `${color}14`, color }}
        >
          {icon}
        </span>
      </div>
      {loading ? (
        <Loader2 className="size-4 animate-spin text-primary mt-3" />
      ) : (
        <div className="kpi-card-value">{value}</div>
      )}
      {sub !== undefined && <div className="kpi-card-sub">{sub}</div>}
    </div>
  );
}
