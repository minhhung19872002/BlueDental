import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/utils/format";
import type { CampaignDetail } from "../../api/campaignApi";
import { formatCount } from "../stats/statsFormat";
import { campaignAudience, channelChip } from "./campaignLook";

interface CampaignResultHeadProps {
  /** Null while the send is still loading: the crumbs and buttons show, the rest waits. */
  campaign: CampaignDetail | null;
  listPath: string;
  actions: ReactNode;
}

/** "Gửi tay", or "Hẹn giờ 24/10 08:00" when it was booked for later. */
function modeChip(campaign: CampaignDetail): string {
  return campaign.scheduledAt
    ? t("CSKH:Campaign:Chip:Scheduled", formatDateTime(campaign.scheduledAt))
    : t("CSKH:Campaign:Chip:Manual");
}

function Chips({ campaign }: { campaign: CampaignDetail }) {
  const sentAt = campaign.startedAt ?? campaign.creationTime;
  return (
    <ul className="cmp-chips" aria-label={t("CSKH:Campaign:Result")}>
      <li className="cskh-badge cskh-badge--blue">{channelChip(campaign.channel)}</li>
      {campaign.externalTemplateId && (
        <li className="cskh-badge">{t("CSKH:Campaign:Chip:TemplateId", campaign.externalTemplateId)}</li>
      )}
      <li className="cskh-badge">{modeChip(campaign)}</li>
      <li className="cskh-badge">
        {t("CSKH:Campaign:Chip:Sender", campaign.senderName ?? "—", formatDateTime(sentAt))}
      </li>
      <li className="cskh-badge">
        {t("CSKH:Campaign:Chip:Audience", campaignAudience(campaign), formatCount(campaign.selectedCount))}
      </li>
    </ul>
  );
}

/** "Chiến dịch đã gửi / Kết quả lần gửi", then the send itself: which template, how and to whom. */
export function CampaignResultHead({ campaign, listPath, actions }: CampaignResultHeadProps) {
  return (
    <header className="cmp-head">
      <div className="tpe-head">
        <nav className="tpe-crumbs" aria-label={t("CSKH:Tab:Campaign")}>
          <Link className="tpe-crumb" to={listPath}>
            {t("CSKH:Tab:Campaign")}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{t("CSKH:Campaign:Result")}</span>
        </nav>
        <PageHeader title={t("CSKH:Campaign:Result")} />
        <div className="cmp-head-actions">{actions}</div>
      </div>
      {campaign && (
        <div className="reception-card cmp-head-card">
          <h2 className="cmp-title">{t("CSKH:Campaign:Title", campaign.templateName)}</h2>
          <Chips campaign={campaign} />
        </div>
      )}
    </header>
  );
}
