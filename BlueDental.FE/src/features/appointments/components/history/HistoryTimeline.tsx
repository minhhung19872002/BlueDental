import { useMemo } from "react";
import { Spin } from "antd";
import dayjs from "dayjs";
import { RightOutlined } from "@ant-design/icons";
import { LetterAvatar } from "@/components/LetterAvatar";
import { useLoadMoreSentinel } from "@/hooks/useLoadMoreSentinel";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { HistoryEntry } from "../../types/appointmentHistory";
import { ActionBadge, HistoryPill, SourceBadge } from "./HistoryBadges";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { ACTION_META, dash } from "./historyLabels";

interface Props {
  entries: HistoryEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

interface DayGroup {
  key: string;
  heading: string;
  entries: HistoryEntry[];
}

/** Rows arrive newest first; each clinic day becomes one group in that order. */
function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  // The day format is translated as a whole ("05 tháng 9 2026" / "05 Sep 2026");
  // dayjs itself follows the app language for the month name.
  const dayFormat = t("DD [tháng] M YYYY");
  for (const entry of entries) {
    const day = dayjs(entry.occurredAt);
    const key = day.format("YYYY-MM-DD");
    let group = groups.get(key);
    if (!group) {
      group = { key, heading: day.format(dayFormat), entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

function TimelineItem({
  entry,
  open,
  onToggle,
}: {
  entry: HistoryEntry;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const tone = ACTION_META[entry.action].tone;
  return (
    <li className="ah-tl-entry">
      <button
        type="button"
        className={cn("ah-tl-item", open && "ah-tl-item--open")}
        aria-expanded={open}
        onClick={() => onToggle(entry.id)}
      >
        <span aria-hidden="true" className={cn("ah-dot", "ah-dot--lg", `ah-dot--${tone}`)} />
        <span className="ah-tl-time">{dayjs(entry.occurredAt).format("HH:mm")}</span>
        <span className="ah-tl-main">
          <span className="ah-tl-badges">
            <ActionBadge action={entry.action} />
            <HistoryPill>{t("Thông tin")}</HistoryPill>
            <SourceBadge source={entry.source} />
          </span>
          <span className="ah-tl-actor">
            <LetterAvatar name={entry.actorName} className="ah-avatar ah-avatar--sm" />
            <span>{entry.actorName}</span>
          </span>
        </span>
        <span className="ah-tl-right">
          <span className="ah-tl-ip">{dash(entry.ipAddress)}</span>
          <RightOutlined className={cn("ah-tl-chevron", open && "ah-tl-chevron--open")} />
        </span>
      </button>
      {open && (
        <div className="ah-tl-detail">
          <HistoryDetailPanel entry={entry} />
        </div>
      )}
    </li>
  );
}

/**
 * Dòng thời gian: the same rows, grouped by day, each opening in place.
 * It has no pager; reaching its end asks for the next page.
 */
export function HistoryTimeline({
  entries,
  loading,
  expandedId,
  onToggle,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const groups = useMemo(() => groupByDay(entries), [entries]);
  const sentinelRef = useLoadMoreSentinel(hasMore && !loadingMore, onLoadMore);

  if (!loading && groups.length === 0) {
    return <div className="ah-empty">{t("Chưa có thay đổi nào trong khoảng thời gian này")}</div>;
  }

  return (
    <div className={cn("ah-timeline", loading && "ah-timeline--loading")} data-testid="ah-timeline">
      {groups.map((group) => (
        <section key={group.key} className="ah-tl-group">
          <header className="ah-tl-head">
            <span className="ah-tl-date">{group.heading}</span>
            <span className="ah-tl-count">{t("{0} mục", group.entries.length)}</span>
          </header>
          <ul className="ah-tl-list">
            {group.entries.map((entry) => (
              <TimelineItem
                key={entry.id}
                entry={entry}
                open={entry.id === expandedId}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </section>
      ))}
      {/* Scrolling this line into view asks for the next page. */}
      <div ref={sentinelRef} className="ah-tl-sentinel" aria-hidden="true" />
      {loadingMore && (
        <div className="ah-tl-more" role="status">
          <Spin size="small" />
          <span>{t("Đang tải thêm...")}</span>
        </div>
      )}
    </div>
  );
}
