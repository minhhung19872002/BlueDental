import { useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useTablePagination } from "@/hooks/useTablePagination";
import { withBranch } from "@/lib/clinicBranch";
import { countedTotal } from "@/utils/countedTotal";
import { formatMoneyUnit } from "@/utils/format";
import {
  CAMPAIGN_OUTCOME,
  useCampaignRecipients,
  type CampaignDetail,
  type CampaignOutcome,
  type CampaignRecipient,
  type CampaignTabs,
} from "../../api/campaignApi";
import { formatCount } from "../stats/statsFormat";
import { outcomeLook } from "./campaignLook";

type TabKey = keyof CampaignTabs;

const TAB_OUTCOME: Record<TabKey, CampaignOutcome | null> = {
  all: null,
  succeeded: CAMPAIGN_OUTCOME.Succeeded,
  failed: CAMPAIGN_OUTCOME.Failed,
  skipped: CAMPAIGN_OUTCOME.Skipped,
};

const TAB_LABEL: Record<TabKey, string> = {
  all: "CSKH:Campaign:Tab:All",
  succeeded: "CSKH:Campaign:Outcome:Succeeded",
  failed: "CSKH:Campaign:Outcome:Failed",
  skipped: "CSKH:Campaign:Outcome:Skipped",
};

/** "Thời điểm" to the second (BA P2210); the date as well only when it is not the send's own day. */
function formatRecipientAt(at: string, runAt: string): string {
  const instant = dayjs(at);
  return instant.format(instant.isSame(runAt, "day") ? "HH:mm:ss" : "DD/MM/YYYY HH:mm:ss");
}

function buildColumns(branchId: string, runAt: string): ColumnsType<CampaignRecipient> {
  return [
    {
      key: "name",
      title: t("CSKH:Campaign:Col:Customer"),
      width: 220,
      render: (_, row) =>
        row.patientId ? (
          <Link className="cskh-patient-link" to={withBranch(`/patient/${row.patientId}`, branchId)}>
            {row.name}
          </Link>
        ) : (
          row.name
        ),
    },
    { key: "phone", title: t("CSKH:Campaign:Col:Phone"), width: 140, render: (_, row) => row.phone ?? "—" },
    {
      key: "outcome",
      title: t("CSKH:Campaign:Col:Outcome"),
      width: 120,
      render: (_, row) => <StatusBadge {...outcomeLook(row.outcome)} />,
    },
    { key: "detail", title: t("CSKH:Campaign:Col:Detail"), width: 260, render: (_, row) => row.detail },
    {
      key: "at",
      title: t("CSKH:Campaign:Col:At"),
      width: 150,
      render: (_, row) => (row.at ? formatRecipientAt(row.at, runAt) : "—"),
    },
    {
      key: "cost",
      title: t("CSKH:Campaign:Col:Cost"),
      width: 110,
      align: "right",
      render: (_, row) => (row.cost === null ? "—" : formatMoneyUnit(row.cost)),
    },
  ];
}

interface CampaignRecipientsCardProps {
  campaign: CampaignDetail;
  branchId: string;
  /** Still sending: the rows look again as the send goes. */
  live: boolean;
}

/** Every customer of the send, one row each, filtered by how it went (BA P2210). */
export function CampaignRecipientsCard({ campaign, branchId, live }: CampaignRecipientsCardProps) {
  const [tab, setTab] = useState<TabKey>("all");
  const pager = useTablePagination(10);
  const page = { skipCount: pager.skipCount, maxResultCount: pager.maxResultCount };
  const { data, isFetching } = useCampaignRecipients(campaign.id, TAB_OUTCOME[tab], page, live);

  const handleTabChange = (next: TabKey) => {
    setTab(next);
    pager.resetToFirstPage();
  };

  const tabs = (Object.keys(TAB_OUTCOME) as TabKey[]).map((key) => ({
    key,
    label: `${t(TAB_LABEL[key])} · ${formatCount(campaign.tabs[key])}`,
  }));
  /* Sends made before P2210 kept only how many were left out, not who. */
  const unrecordedSkips = campaign.skippedCount - campaign.tabs.skipped;

  return (
    <section className="reception-card cmp-recipients-card">
      <SegmentedTabs items={tabs} activeKey={tab} onChange={handleTabChange} />
      {unrecordedSkips > 0 && (
        <p className="cmp-note">{t("CSKH:Campaign:SkippedUnrecorded", formatCount(unrecordedSkips))}</p>
      )}
      <div className="cskh-table-card">
        <DataTable<CampaignRecipient>
          className="cskh-table"
          rowKey="id"
          columns={buildColumns(branchId, campaign.lastRunAt)}
          dataSource={data?.items ?? []}
          loading={isFetching && !data}
          pagination={pager.buildConfig(data?.totalCount ?? 0, countedTotal(t("CSKH:Campaign:Noun:Customer")))}
          locale={{ emptyText: t("CSKH:Campaign:NoRecipients") }}
        />
      </div>
    </section>
  );
}
