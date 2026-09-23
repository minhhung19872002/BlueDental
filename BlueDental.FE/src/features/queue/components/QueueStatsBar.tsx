import { t } from "@/lib/i18n";
import { QueueTicketStatus, type QueueStats, type QueueTicketStatus as QueueTicketStatusType } from "../types";

interface QueueStatsBarProps {
  stats: QueueStats | undefined;
  loading: boolean;
  activeStatus: QueueTicketStatusType | null;
  onStatusClick: (status: QueueTicketStatusType | null) => void;
}

const KPI_ITEMS: {
  key: keyof QueueStats;
  labelKey: string;
  color: string;
  status: QueueTicketStatusType | null;
}[] = [
  { key: "totalToday", labelKey: "Queue:Stats:Total", color: "var(--bd-ink)", status: null },
  { key: "waiting", labelKey: "Queue:Stats:Waiting", color: "var(--bd-warning, #f59e0b)", status: QueueTicketStatus.Waiting },
  { key: "called", labelKey: "Queue:Stats:Called", color: "var(--bd-info, #3b82f6)", status: QueueTicketStatus.Called },
  { key: "serving", labelKey: "Queue:Stats:Serving", color: "var(--bd-success, #22c55e)", status: QueueTicketStatus.Serving },
  { key: "completed", labelKey: "Queue:Stats:Completed", color: "var(--bd-muted)", status: QueueTicketStatus.Completed },
];

export function QueueStatsBar({ stats, loading, activeStatus, onStatusClick }: QueueStatsBarProps) {
  return (
    <div className="queue-kpis">
      {KPI_ITEMS.map(({ key, labelKey, color, status }) => {
        const isActive = activeStatus === status;
        return (
          <div
            key={key}
            className={["page-card queue-kpi", isActive && "queue-kpi--active"].filter(Boolean).join(" ")}
            style={{ cursor: "pointer", "--queue-kpi-accent": color } as React.CSSProperties}
            onClick={() => onStatusClick(isActive ? null : status)}
          >
            <div className="billing-kpi-label">{t(labelKey)}</div>
            <div className="billing-kpi-value" style={{ color }}>
              {loading ? "—" : (stats?.[key] ?? 0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
