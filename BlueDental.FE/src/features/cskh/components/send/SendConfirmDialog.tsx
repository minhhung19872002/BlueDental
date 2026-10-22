import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/utils/format";
import type { SendRequest, SendSubmit } from "../../hooks/useSendSubmit";

function questionOf({ input, count, channelName, templateName }: SendRequest): string {
  if (input.scheduledAt) {
    return t("CSKH:Send:ConfirmLater", count, channelName, templateName, formatDateTime(input.scheduledAt));
  }
  return t("CSKH:Send:ConfirmNow", count, channelName, templateName);
}

/** Asked once before a send goes out: a sent message cannot be called back. */
export function SendConfirmDialog({ submit }: { submit: SendSubmit }) {
  return (
    <ConfirmDialog
      open={submit.request !== null}
      title={t("CSKH:Send:ConfirmTitle")}
      message={submit.request ? questionOf(submit.request) : ""}
      pending={submit.sending}
      onConfirm={submit.confirm}
      onClose={submit.close}
    />
  );
}
