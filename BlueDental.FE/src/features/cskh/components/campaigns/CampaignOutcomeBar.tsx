import type { CSSProperties } from "react";
import { Tooltip } from "antd";
import { t } from "@/lib/i18n";
import { CAMPAIGN_OUTCOME, type CampaignDetail, type CampaignOutcome } from "../../api/campaignApi";
import { ratePercent } from "../../api/statsAdapters";
import { formatCount, formatPercent } from "../stats/statsFormat";

interface Segment {
  outcome: CampaignOutcome;
  label: string;
  count: number;
}

/** BA order — Thành công · Lỗi · Bị loại — then whatever is still waiting or was stopped. */
function segmentsOf(campaign: CampaignDetail): Segment[] {
  return [
    { outcome: CAMPAIGN_OUTCOME.Succeeded, label: t("CSKH:Campaign:Bar:Succeeded"), count: campaign.succeededCount },
    { outcome: CAMPAIGN_OUTCOME.Failed, label: t("CSKH:Campaign:Bar:Failed"), count: campaign.failedCount },
    { outcome: CAMPAIGN_OUTCOME.Skipped, label: t("CSKH:Campaign:Bar:Skipped"), count: campaign.skippedCount },
    { outcome: CAMPAIGN_OUTCOME.Pending, label: t("CSKH:Campaign:Outcome:Pending"), count: campaign.pendingCount },
    { outcome: CAMPAIGN_OUTCOME.Stopped, label: t("CSKH:Campaign:Outcome:Stopped"), count: campaign.stoppedCount },
  ];
}

const share = (count: number, total: number) => formatPercent(ratePercent(count, total));

/**
 * Where every chosen customer ended up, as one bar over Khách đã chọn, with the
 * reasons in plain words beneath. Colour is never the only cue: each part is
 * named with its count in the legend, and the table below lists every customer.
 */
export function CampaignOutcomeBar({ campaign }: { campaign: CampaignDetail }) {
  const total = campaign.selectedCount;
  const segments = segmentsOf(campaign);
  const shown = segments.filter((segment) => segment.count > 0);
  const summary = shown.map((segment) => `${segment.label} ${formatCount(segment.count)}`).join(", ");

  return (
    <section className="reception-card cmp-bar-card">
      <h2 className="cmp-section-title">
        {t("CSKH:Campaign:Bar:Title", formatCount(total), formatCount(campaign.succeededCount))}
      </h2>
      <div className="cmp-bar" role="img" aria-label={summary || t("CSKH:Campaign:NoRecipients")}>
        {shown.map((segment) => (
          <Tooltip
            key={segment.outcome}
            title={t("CSKH:Campaign:Bar:Tip", segment.label, formatCount(segment.count), share(segment.count, total))}
          >
            <span
              className={`cmp-bar-part cmp-tone--${segment.outcome}`}
              style={{ "--part": segment.count } as CSSProperties}
            />
          </Tooltip>
        ))}
      </div>
      <ul className="cmp-legend">
        {segments
          .filter((segment) => segment.count > 0 || segment.outcome <= CAMPAIGN_OUTCOME.Skipped)
          .map((segment) => (
            <li key={segment.outcome} className="cmp-legend-item">
              <span className={`cmp-swatch cmp-tone--${segment.outcome}`} aria-hidden="true" />
              <span>{segment.label}</span>
              <strong>{formatCount(segment.count)}</strong>
              <span className="cskh-stats-sub">{share(segment.count, total)}</span>
            </li>
          ))}
      </ul>
      {campaign.reasons.length > 0 && (
        <ul className="cmp-reasons" aria-label={t("CSKH:Campaign:Bar:Reasons")}>
          {campaign.reasons.map((reason) => (
            <li key={`${reason.outcome}-${reason.label}`} className="cmp-reason">
              <span className={`cmp-swatch cmp-tone--${reason.outcome}`} aria-hidden="true" />
              <span className="cmp-reason-label">{reason.label}</span>
              <strong>{formatCount(reason.count)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
