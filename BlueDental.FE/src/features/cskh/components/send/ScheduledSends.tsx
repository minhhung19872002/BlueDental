import { useState } from "react";
import { Button } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/utils/format";
import { useCancelSend, useScheduledSends, type SendBatch } from "../../api/sendApi";
import { channelLabels } from "../../api/templateApi";
import { EditorCard } from "../template-editor/EditorCard";

/** "Lịch gửi đã hẹn": the sends still waiting for their time; each can be called off until then. */
export function ScheduledSends({ canCancel }: { canCancel: boolean }) {
  const batches = useScheduledSends();
  const cancel = useCancelSend();
  const [cancelling, setCancelling] = useState<SendBatch | null>(null);

  const items = batches.data ?? [];
  if (items.length === 0) return null;

  const handleConfirm = () => {
    if (!cancelling) return;
    cancel.mutate(cancelling.id, {
      onSuccess: () => {
        toast.success(t("CSKH:Send:CancelledToast"));
        setCancelling(null);
      },
    });
  };

  return (
    <EditorCard className="snd-queued" title={t("CSKH:Send:Queued")}>
      <ul className="snd-queued-list">
        {items.map((batch) => (
          <li key={batch.id} className="snd-queued-item">
            <span className="snd-queued-text">
              <strong>{batch.templateName}</strong>
              <span>{t("CSKH:Send:QueuedLine", batch.recipientCount, channelLabels()[batch.channel], t("CSKH:Send:QueuedAt", formatDateTime(batch.scheduledAt)))}</span>
            </span>
            {canCancel && (
              <Button size="small" danger onClick={() => setCancelling(batch)}>
                {t("CSKH:Send:CancelSchedule")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={cancelling !== null}
        title={t("CSKH:Send:CancelTitle")}
        message={cancelling ? t("CSKH:Send:CancelConfirm", cancelling.templateName, formatDateTime(cancelling.scheduledAt)) : ""}
        pending={cancel.isPending}
        onConfirm={handleConfirm}
        onClose={() => setCancelling(null)}
      />
    </EditorCard>
  );
}
