import type { TooltipContentProps } from "recharts";
import { t } from "@/lib/i18n";
import type { StatsBar } from "../../api/statsAdapters";
import { formatCount } from "./statsFormat";

function isBar(value: unknown): value is StatsBar {
  return typeof value === "object" && value !== null && "key" in value && "sent" in value;
}

/** One bar's day (or month): sent, then how many arrived and how many failed. */
export function StatsDayTooltip({ active, payload }: TooltipContentProps) {
  const bar: unknown = payload?.[0]?.payload;
  if (!active || !isBar(bar)) return null;

  return (
    <div className="cskh-stats-tooltip">
      <strong>{bar.label}</strong>
      <span>
        {t("CSKH:Stats:Col:Sent")}: <b>{formatCount(bar.sent)}</b>
      </span>
      <span>
        {t("CSKH:Stats:Col:Succeeded")}: <b>{formatCount(bar.succeeded)}</b>
      </span>
      <span>
        {t("CSKH:Stats:Col:Failed")}: <b>{formatCount(bar.failed)}</b>
      </span>
    </div>
  );
}
