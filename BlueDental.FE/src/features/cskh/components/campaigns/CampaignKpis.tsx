import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  InboxOutlined,
  PauseCircleOutlined,
  SendOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { KpiCard } from "@/components/KpiCard";
import { formatMoneyUnit } from "@/utils/format";
import type { CampaignDetail } from "../../api/campaignApi";
import { ratePercent } from "../../api/statsAdapters";
import { formatCount, formatPercent } from "../stats/statsFormat";

/** "4 tin × 300đ" when every charged message cost the same, else just how many were charged. */
function costSub(campaign: CampaignDetail): string {
  const messages = formatCount(campaign.chargedCount);
  return campaign.pricePerMessage === null
    ? t("CSKH:Campaign:Kpi:CostCount", messages)
    : t("CSKH:Campaign:Kpi:CostSub", messages, formatMoneyUnit(campaign.pricePerMessage));
}

/**
 * The send in figures, left to right as it went: chosen → left out → sent →
 * succeeded / failed → received → what it cost. Đã dừng only once something was stopped.
 */
export function CampaignKpis({ campaign }: { campaign: CampaignDetail }) {
  const sent = campaign.succeededCount + campaign.failedCount;
  const ofSent = (count: number) => t("CSKH:Campaign:Kpi:OfSent", formatPercent(ratePercent(count, sent)));

  return (
    <div className="kpi-grid cmp-kpis">
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Selected")}
        value={formatCount(campaign.selectedCount)}
        icon={<TeamOutlined />}
        color="var(--bd-primary)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Skipped")}
        value={formatCount(campaign.skippedCount)}
        sub={t("CSKH:Campaign:Kpi:OfSelected", formatPercent(ratePercent(campaign.skippedCount, campaign.selectedCount)))}
        icon={<StopOutlined />}
        color="var(--bd-dim)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Sent")}
        value={formatCount(sent)}
        sub={campaign.pendingCount > 0 ? t("CSKH:Campaign:Kpi:Pending", formatCount(campaign.pendingCount)) : undefined}
        icon={<SendOutlined />}
        color="var(--bd-primary)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Succeeded")}
        value={formatCount(campaign.succeededCount)}
        sub={ofSent(campaign.succeededCount)}
        icon={<CheckCircleOutlined />}
        color="var(--bd-green)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Failed")}
        value={formatCount(campaign.failedCount)}
        sub={ofSent(campaign.failedCount)}
        icon={<CloseCircleOutlined />}
        color="var(--bd-red)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Delivered")}
        value={formatCount(campaign.deliveredCount)}
        sub={t("CSKH:Campaign:Kpi:DeliveredSub")}
        icon={<InboxOutlined />}
        color="var(--bd-teal)"
      />
      <KpiCard
        label={t("CSKH:Campaign:Kpi:Cost")}
        value={formatMoneyUnit(campaign.cost)}
        sub={costSub(campaign)}
        icon={<DollarOutlined />}
        color="var(--bd-gold)"
      />
      {campaign.stoppedCount > 0 && (
        <KpiCard
          label={t("CSKH:Campaign:Kpi:Stopped")}
          value={formatCount(campaign.stoppedCount)}
          sub={t("CSKH:Campaign:Kpi:StoppedSub")}
          icon={<PauseCircleOutlined />}
          color="var(--bd-muted)"
        />
      )}
    </div>
  );
}
