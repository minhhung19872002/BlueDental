import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "antd";
import { PlusOutlined, SendOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { RemainingHeight } from "@/components/RemainingHeight";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { useInboxCounts } from "../api/inboxApi";
import { MESSAGE_CHANNEL } from "../api/templateApi";
import { anchorForMode, careDateModeOf, careTabByKey, CARE_TABS } from "../careTabs";
import { campaignResultPath, sendPath, templateEditorPath } from "../templatePaths";
import { CareBoard } from "../components/CareBoard";
import { CareDateBar } from "../components/CareDateBar";
import { GroupPatientsPanel } from "../components/GroupPatientsPanel";
import { CampaignListTab } from "../components/campaigns/CampaignListTab";
import { InboxTab } from "../components/inbox/InboxTab";
import { TemplateListTab } from "../components/templates/TemplateListTab";
import "../components/cskh.css";
import "../components/cskh-template.css";
import "../components/cskh-stats.css";
import "../components/campaigns/cskh-campaign.css";
import "../components/cskh-inbox.css";

type TopTabKey = "care" | "group" | "inbox" | "campaign" | "template";

/* BA P2210 order: Chăm sóc khách hàng · Phân nhóm CSKH · Hộp thư Zalo · Chiến dịch · Template tin nhắn. */
const TOP_TABS: Array<{ key: TopTabKey; label: () => string }> = [
  { key: "care", label: () => t("CSKH:Tab:Care") },
  { key: "group", label: () => t("CSKH:Tab:Group") },
  { key: "inbox", label: () => t("CSKH:Tab:Inbox") },
  { key: "campaign", label: () => t("CSKH:Tab:Campaign") },
  { key: "template", label: () => t("CSKH:Tab:Template") },
];

/**
 * /cskh-grouping — the reference keeps tab, page, care_dateMode, care_date and
 * taxonomyId in the URL; every other filter is transient component state.
 */
export function CskhGroupingPage() {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const careAbility = useAbility("cskhCare");
  const groupAbility = useAbility("cskhGroup");
  const templateAbility = useAbility("cskhTemplate");
  const inboxAbility = useAbility("cskhInbox");
  const { canRead: canSend, canCreate: canCreateSend } = useAbility("cskhSend");
  const inboxCounts = useInboxCounts(inboxAbility.canRead);

  const tabAccess: Record<TopTabKey, boolean> = {
    care: careAbility.canRead,
    group: groupAbility.canRead,
    inbox: inboxAbility.canRead,
    campaign: canSend,
    template: templateAbility.canRead,
  };
  const visibleTabs = useMemo(
    () => TOP_TABS.filter((item) => tabAccess[item.key]),
    [tabAccess.care, tabAccess.group, tabAccess.inbox, tabAccess.campaign, tabAccess.template], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const unreplied = inboxCounts.data?.unreplied ?? 0;

  const rawTab = searchParams.get("tab");
  const topTab: TopTabKey =
    visibleTabs.find((item) => item.key === rawTab)?.key ?? visibleTabs[0]?.key ?? "care";
  const careTab = careTabByKey(searchParams.get("page"));
  const mode = careDateModeOf(searchParams.get("care_dateMode"));
  const rawParam = searchParams.get("care_date");
  const rawDate = rawParam ? dayjs(rawParam) : null;
  const date = rawDate?.isValid() ? rawDate : anchorForMode(mode, dayjs());
  const taxonomyId = searchParams.get("taxonomyId") ?? undefined;

  const setParam = (mutate: (params: URLSearchParams) => void) => {
    setSearchParams((params) => {
      mutate(params);
      return params;
    });
  };

  /** "new" opens a blank editor; an id opens that template. */
  const openTemplate = (id: string) =>
    navigate(withBranch(templateEditorPath(id), branchId));
  /* "Dùng mẫu này để gửi": the template names its own channel. */
  const sendWithTemplate = (id: string) =>
    navigate(withBranch(sendPath({ templateId: id }), branchId));
  /* Gửi tin nhắn chăm sóc: the care tab's list over the period on screen, on Zalo — BA P2110. */
  const sendCare = () =>
    navigate(withBranch(sendPath({
      channel: MESSAGE_CHANNEL.Zalo,
      page: careTab.key,
      dateMode: mode,
      date: date.format("YYYY-MM-DD"),
    }), branchId));

  return (
    <div className="reception-page">
      <PageHeader title={t("CSKH:PageTitle")} />

      <div className="pill-tabs-row">
        <div className="pill-tabs">
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={["pill-tab", topTab === item.key && "pill-tab--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setParam((params) => params.set("tab", item.key))}
            >
              {item.label()}
              {item.key === "inbox" && unreplied > 0 && (
                <span className="ibx-tab-badge" aria-label={t("CSKH:Inbox:Badge", unreplied)}>
                  {unreplied}
                </span>
              )}
            </button>
          ))}
        </div>
        {topTab === "template" && templateAbility.canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openTemplate("new")}>
            {t("CSKH:Template:Create")}
          </Button>
        )}
        {topTab === "care" && canSend && (
          <Button icon={<SendOutlined />} onClick={sendCare}>
            {t("CSKH:Action:SendCare")}
          </Button>
        )}
        {topTab === "campaign" && canCreateSend && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(withBranch(sendPath(), branchId))}>
            {t("CSKH:Campaign:Create")}
          </Button>
        )}
      </div>

      {topTab === "campaign" && (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill">
            <CampaignListTab
              canStop={canCreateSend}
              onOpen={(id) => navigate(withBranch(campaignResultPath(id), branchId))}
            />
          </div>
        </RemainingHeight>
      )}

      {topTab === "template" && (
        <RemainingHeight>
          <TemplateListTab
            canCreate={templateAbility.canCreate}
            canUpdate={templateAbility.canUpdate}
            onEdit={openTemplate}
            onUseToSend={canSend ? sendWithTemplate : undefined}
          />
        </RemainingHeight>
      )}

      {topTab === "inbox" && (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill ibx-card">
            <InboxTab canHandle={inboxAbility.canUpdate} />
          </div>
        </RemainingHeight>
      )}

      {topTab === "care" && (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill">
            <CareBoard
              branchId={branchId}
              tab={careTab}
              mode={mode}
              date={date}
              canExport={careAbility.canExport}
              canCreate={careAbility.canCreate}
              canUpdate={careAbility.canUpdate}
              canSend={canSend}
              dateSlot={
                <CareDateBar
                  mode={mode}
                  date={date}
                  onModeChange={(nextMode) =>
                    setParam((params) => {
                      params.set("care_dateMode", nextMode);
                      params.set(
                        "care_date",
                        anchorForMode(nextMode, dayjs()).format("YYYY-MM-DD"),
                      );
                    })
                  }
                  onDateChange={(nextDate) =>
                    setParam((params) => params.set("care_date", nextDate.format("YYYY-MM-DD")))
                  }
                />
              }
              tabsSlot={
                <SegmentedTabs
                  items={CARE_TABS.map((item) => ({ key: item.key, label: item.label() }))}
                  activeKey={careTab.key}
                  onChange={(key) => setParam((params) => params.set("page", key))}
                />
              }
            />
          </div>
        </RemainingHeight>
      )}

      {topTab === "group" && (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill">
            <GroupPatientsPanel
              branchId={branchId}
              taxonomyId={taxonomyId}
              canUpdate={groupAbility.canUpdate}
              canSend={canSend}
              onTaxonomyChange={(value) =>
                setParam((params) => {
                  if (value) params.set("taxonomyId", value);
                  else params.delete("taxonomyId");
                })
              }
            />
          </div>
        </RemainingHeight>
      )}
    </div>
  );
}
