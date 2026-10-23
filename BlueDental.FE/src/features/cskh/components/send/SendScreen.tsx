import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { useAbility } from "@/hooks/useAbility";
import { describeApiError } from "@/lib/apiError";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { channelLabels } from "../../api/templateApi";
import { useIndividualPicks } from "../../hooks/useIndividualPicks";
import { useRecipientRemoval } from "../../hooks/useRecipientRemoval";
import { useSendActions } from "../../hooks/useSendActions";
import { useSendParams } from "../../hooks/useSendParams";
import { useSendRecipients } from "../../hooks/useSendRecipients";
import { useSendSchedule } from "../../hooks/useSendSchedule";
import { useSendTemplateChoice } from "../../hooks/useSendTemplateChoice";
import { contactNameOf, sendSummaryOf } from "../../sendSummary";
import { CAMPAIGN_LIST_PATH, careBoardPath, TEMPLATE_LIST_PATH, templateEditorPath } from "../../templatePaths";
import { ScheduledSends } from "./ScheduledSends";
import { SendActions } from "./SendActions";
import { SendChannelStep } from "./SendChannelStep";
import { SendChecks } from "./SendChecks";
import { SendConfirmDialog } from "./SendConfirmDialog";
import { SendHeader } from "./SendHeader";
import { SendPreviewCard } from "./SendPreviewCard";
import { SendRecipientsStep } from "./SendRecipientsStep";
import { SendScheduleFields } from "./SendScheduleFields";
import { SendSummaryCard } from "./SendSummaryCard";
import { SendTemplateStep } from "./SendTemplateStep";

/**
 * Gửi tin nhắn (F-77, BA P2110 + Send.dc.html): the three steps on the left,
 * the checks, preview, summary and the CTA on the right. Without "Gửi tin
 * nhắn › Tạo" the screen still shows who a send would reach, but no button sends.
 */
export function SendScreen() {
  const params = useSendParams();
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const { canCreate } = useAbility("cskhSend");
  const choice = useSendTemplateChoice(params.channelParam, params.templateId);
  const picks = useIndividualPicks(params.lockedPatientId);
  const removal = useRecipientRemoval(`${params.source}|${params.careTab.key}|${params.period.fromDate}`);
  const [skipRecent, setSkipRecent] = useState(true);
  const schedule = useSendSchedule();
  const recipients = useSendRecipients({
    channel: choice.channel,
    templateId: choice.template?.id ?? null,
    source: params.source,
    careRecordId: params.careRecordId,
    careType: params.careTab.type,
    period: params.period,
    skipRecent,
    picks,
    removal,
  });
  const channelName = channelLabels()[choice.channel];
  const actions = useSendActions({
    channelName,
    choice,
    source: params.source,
    picks,
    recipients,
    removedCount: removal.count,
    schedule,
    /* The send lands on top of "Chiến dịch đã gửi" (BA P2210). */
    onSent: () => navigate(withBranch(CAMPAIGN_LIST_PATH, branchId)),
  });

  const carePath = withBranch(careBoardPath(params.careTab.key, params.mode, params.date.format("YYYY-MM-DD")), branchId);
  const header = <SendHeader carePath={carePath} />;

  if (choice.loading) {
    return (
      <div className="page-container tpe-page tpe-page--center">
        <Spin size="large" />
      </div>
    );
  }
  if (choice.error) {
    return (
      <div className="page-container tpe-page">
        {header}
        <EmptyState title={describeApiError(choice.error).message} />
      </div>
    );
  }

  const contactName = contactNameOf(choice.channel);
  const summary = sendSummaryOf({
    channelName,
    templateName: choice.template?.name ?? null,
    list: params.source === "list" ? { tab: params.careTab, mode: params.mode, period: params.period } : null,
    pickedCount: picks.checkedIds.length,
    stats: recipients.stats,
    pricePerMessage: recipients.pricePerMessage,
  });

  return (
    <div className="page-container tpe-page snd-page">
      {header}
      <div className="snd-layout">
        <div className="snd-main">
          <SendChannelStep channel={choice.channel} channels={choice.channels} onChange={params.setChannel} />
          <SendTemplateStep
            channelName={channelName}
            templates={choice.templates}
            template={choice.template}
            createPath={withBranch(templateEditorPath("new"), branchId)}
            listPath={withBranch(TEMPLATE_LIST_PATH, branchId)}
            onPick={params.setTemplate}
          />
          <SendRecipientsStep
            params={params}
            channel={choice.channel}
            contactName={contactName}
            recipients={recipients}
            picks={picks}
            removal={removal}
            skipRecent={skipRecent}
            onSkipRecentChange={setSkipRecent}
          />
        </div>
        <aside className="snd-side" aria-label={t("CSKH:Send:Checks")}>
          <SendChecks
            channelName={channelName}
            contactName={contactName}
            connected={choice.connected}
            template={choice.template}
            stats={recipients.stats}
            skipRecent={skipRecent}
          />
          <SendPreviewCard
            channel={choice.channel}
            channelName={channelName}
            templateId={choice.template?.id ?? null}
            target={actions.target}
          />
          <SendSummaryCard summary={summary} contactName={contactName}>
            {canCreate && <SendScheduleFields schedule={schedule} />}
            {canCreate && <SendActions send={actions.send} test={actions.test} />}
          </SendSummaryCard>
          <ScheduledSends canCancel={canCreate} />
        </aside>
      </div>
      <SendConfirmDialog submit={actions.submit} />
    </div>
  );
}
