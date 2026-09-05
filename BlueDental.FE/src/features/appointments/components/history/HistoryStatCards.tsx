import type { ComponentType } from "react";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  Pencil,
  RefreshCw,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { HistoryAction, HistoryStats, HistoryStatusGroup } from "../../types/appointmentHistory";
import {
  ACTION_META,
  ACTION_ORDER,
  STATUS_GROUP_META,
  STATUS_GROUP_ORDER,
  type HistoryTone,
} from "./historyLabels";

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

const ACTION_ICONS: Record<HistoryAction, IconType> = {
  created: CalendarPlus,
  updated: Pencil,
  statusChanged: RefreshCw,
  cancelled: Ban,
  deleted: Trash2,
};

const STATUS_ICONS: Record<HistoryStatusGroup, IconType> = {
  scheduled: CalendarCheck,
  arrived: UserCheck,
  cancelled: XCircle,
  noShow: Clock,
};

interface Card {
  key: string;
  label: string;
  value: number;
  tone: HistoryTone;
  Icon: IconType;
}

/**
 * The reference only shows a card once there is something to count, so the
 * row grows as the history does: the total, then each action seen, then each
 * status an existing appointment was moved to.
 */
function buildCards(stats: HistoryStats): Card[] {
  const cards: Card[] = [
    { key: "total", label: t("Tổng thao tác"), value: stats.total, tone: "gray", Icon: CalendarClock },
  ];
  for (const action of ACTION_ORDER) {
    const value = stats.byAction[action] ?? 0;
    if (value > 0) {
      cards.push({
        key: action,
        label: t(ACTION_META[action].label),
        value,
        tone: ACTION_META[action].tone,
        Icon: ACTION_ICONS[action],
      });
    }
  }
  for (const group of STATUS_GROUP_ORDER) {
    const value = stats.byStatusTo[group] ?? 0;
    if (value > 0) {
      cards.push({
        key: `status-${group}`,
        label: t(STATUS_GROUP_META[group].label),
        value,
        tone: STATUS_GROUP_META[group].tone,
        Icon: STATUS_ICONS[group],
      });
    }
  }
  return cards;
}

export function HistoryStatCards({ stats }: { stats: HistoryStats | undefined }) {
  if (!stats) return null;
  // Nothing in the week: the reference swaps the cards for one quiet bar.
  if (stats.total === 0) {
    return (
      <div className="ah-stats-empty" data-testid="ah-stats">
        {t("Chưa có thao tác nào trong khoảng thời gian này.")}
      </div>
    );
  }
  return (
    <div className="ah-stats" data-testid="ah-stats">
      {buildCards(stats).map(({ key, label, value, tone, Icon }) => (
        <div key={key} className={cn("ah-stat", `ah-stat--${tone}`)}>
          <div className="ah-stat-label">
            <Icon size={14} strokeWidth={2} />
            <span>{label}</span>
          </div>
          <div className="ah-stat-value">{value}</div>
        </div>
      ))}
    </div>
  );
}
