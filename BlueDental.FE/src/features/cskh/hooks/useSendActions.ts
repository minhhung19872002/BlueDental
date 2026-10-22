import { t } from "@/lib/i18n";
import { previewTargetOf, sampleRecipient } from "../sendRecipients";
import { sendBlocker } from "../sendSummary";
import type { IndividualPicks } from "./useIndividualPicks";
import { sendSelection, type SendRecipients } from "./useSendRecipients";
import type { SendSchedule } from "./useSendSchedule";
import type { SendSource } from "./useSendParams";
import { useSendSubmit } from "./useSendSubmit";
import type { SendTemplateChoice } from "./useSendTemplateChoice";

interface SendActionsArgs {
  channelName: string;
  choice: SendTemplateChoice;
  source: SendSource;
  picks: IndividualPicks;
  recipients: SendRecipients;
  removedCount: number;
  schedule: SendSchedule;
  onSent: () => void;
}

/** One button of the summary card, already worded. */
export interface SendAction {
  label: string;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}

const NO_TARGET = { patientId: null, appointmentId: null };

/**
 * The CTA and "Gửi thử … tới tôi". The CTA sends exactly the rows in play —
 * the list minus "Xóa", or the ticked customers — and asks before it does.
 */
export function useSendActions(args: SendActionsArgs) {
  const { channelName, choice, source, picks, recipients, removedCount, schedule, onSent } = args;
  const submit = useSendSubmit(onSent);
  const { template, connected } = choice;
  const { stats, inPlay } = recipients;
  const target = sampleRecipient(inPlay);

  const blocker = sendBlocker({
    channelName,
    hasTemplate: template !== null,
    connected,
    nobodyPicked: source === "individual" && picks.checkedIds.length === 0,
    sendable: stats.sendable,
    schedulePast: schedule.isPast,
  });

  const handleSend = () => {
    if (!template) return;
    submit.ask({
      input: {
        ...recipients.input,
        ...sendSelection(source, inPlay, removedCount, picks.checkedIds),
        scheduledAt: schedule.scheduledAt,
      },
      count: stats.sendable,
      channelName,
      templateName: template.name,
    });
  };

  const handleTest = () => {
    if (template) submit.sendTest({ templateId: template.id, ...(target ? previewTargetOf(target) : NO_TARGET) });
  };

  const send: SendAction = {
    label: blocker ?? t(schedule.enabled ? "CSKH:Send:SendLater" : "CSKH:Send:SendNow", stats.sendable, channelName),
    disabled: blocker !== null || recipients.loading,
    pending: submit.sending,
    onClick: handleSend,
  };
  const test: SendAction = {
    label: t("CSKH:Send:Test", channelName),
    disabled: !template || !connected,
    pending: submit.testing,
    onClick: handleTest,
  };

  return { send, test, target, submit };
}
