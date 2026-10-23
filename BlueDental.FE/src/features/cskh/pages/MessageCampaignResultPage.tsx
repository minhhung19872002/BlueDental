import { useNavigate, useParams } from "react-router-dom";
import { Button, Spin } from "antd";
import { UnorderedListOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { describeApiError } from "@/lib/apiError";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { isCampaignLive, useCampaign } from "../api/campaignApi";
import { CampaignExportButton } from "../components/campaigns/CampaignExportButton";
import { CampaignKpis } from "../components/campaigns/CampaignKpis";
import { CampaignOutcomeBar } from "../components/campaigns/CampaignOutcomeBar";
import { CampaignRecipientsCard } from "../components/campaigns/CampaignRecipientsCard";
import { CampaignResultHead } from "../components/campaigns/CampaignResultHead";
import { CAMPAIGN_LIST_PATH, CARE_LIST_PATH } from "../templatePaths";
import "../components/cskh.css";
import "../components/cskh-template-editor.css";
import "../components/cskh-stats.css";
import "../components/campaigns/cskh-campaign.css";

/** /cskh-grouping/campaigns/:id — "Kết quả lần gửi" of one send (BA P2210, F-79). */
export function MessageCampaignResultPage() {
  const { id = "" } = useParams<{ id: string }>();
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const campaign = useCampaign(id);
  const listPath = withBranch(CAMPAIGN_LIST_PATH, branchId);

  if (campaign.isLoading) {
    return (
      <div className="page-container tpe-page tpe-page--center">
        <Spin size="large" />
      </div>
    );
  }

  const backToCare = (
    <Button type="primary" icon={<UnorderedListOutlined />} onClick={() => navigate(withBranch(CARE_LIST_PATH, branchId))}>
      {t("CSKH:Campaign:BackToCare")}
    </Button>
  );

  if (!campaign.data) {
    // Another branch's send reads as not found, like any missing one.
    const refusal = campaign.isError ? describeApiError(campaign.error).message : null;
    return (
      <div className="page-container cmp-page">
        <CampaignResultHead campaign={null} listPath={listPath} actions={backToCare} />
        <EmptyState title={refusal ?? t("CSKH:Campaign:NotFound")} />
      </div>
    );
  }

  const detail = campaign.data;
  return (
    <div className="page-container cmp-page">
      <CampaignResultHead
        campaign={detail}
        listPath={listPath}
        actions={
          <>
            <CampaignExportButton campaignId={detail.id} />
            {backToCare}
          </>
        }
      />
      <CampaignKpis campaign={detail} />
      <CampaignOutcomeBar campaign={detail} />
      <CampaignRecipientsCard campaign={detail} branchId={branchId} live={isCampaignLive(detail)} />
    </div>
  );
}
