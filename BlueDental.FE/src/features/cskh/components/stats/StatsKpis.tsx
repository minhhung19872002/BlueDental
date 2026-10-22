import { CheckCircleOutlined, CloseCircleOutlined, SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { KpiCard } from "@/components/KpiCard";
import { ratePercent } from "../../api/statsAdapters";
import type { StatsTotals } from "../../api/statsApi";
import { formatCount, formatDelta, formatPercent } from "./statsFormat";

interface Props {
  totals: StatsTotals | undefined;
  /** Null when "So sánh kỳ trước" is off. */
  previous: StatsTotals | null | undefined;
  loading: boolean;
}

const EMPTY: StatsTotals = { sent: 0, succeeded: 0, failed: 0 };

function versusPrevious(totals: StatsTotals, previous: StatsTotals | null | undefined): string | undefined {
  if (!previous) return undefined;
  const delta = formatDelta(totals.sent, previous.sent);
  return delta === null ? t("CSKH:Stats:Card:PreviousEmpty") : t("CSKH:Stats:Card:VsPrevious", delta);
}

/**
 * Tin đã gửi · Gửi thành công · Thất bại. Đã xem / mở and Khách phản hồi are
 * left out: no channel reports them back yet (owner, decision 8).
 */
export function StatsKpis({ totals = EMPTY, previous, loading }: Props) {
  return (
    <div className="kpi-grid cskh-stats-kpis">
      <KpiCard
        label={t("CSKH:Stats:Card:Sent")}
        value={formatCount(totals.sent)}
        sub={versusPrevious(totals, previous)}
        icon={<SendOutlined />}
        color="var(--bd-primary)"
        loading={loading}
      />
      <KpiCard
        label={t("CSKH:Stats:Card:Succeeded")}
        value={formatPercent(ratePercent(totals.succeeded, totals.sent))}
        sub={t("CSKH:Stats:Card:Messages", formatCount(totals.succeeded))}
        icon={<CheckCircleOutlined />}
        color="var(--bd-green)"
        loading={loading}
      />
      <KpiCard
        label={t("CSKH:Stats:Card:Failed")}
        value={formatCount(totals.failed)}
        sub={t("CSKH:Stats:Card:FailRate", formatPercent(ratePercent(totals.failed, totals.sent)))}
        icon={<CloseCircleOutlined />}
        color="var(--bd-red)"
        loading={loading}
      />
    </div>
  );
}
