import { useState } from "react";
import { Button } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useResetCounterSequence } from "../api/queueMutations";
import { previewNumber } from "../utils/counterForm";
import type { ServiceCounter } from "../types";

/**
 * "Đặt lại số thứ tự ngay": numbers already handed out keep theirs; the next
 * one starts again from the start number, stepping over any still in the queue.
 */
export function CounterResetBox({ counter }: { counter: ServiceCounter }) {
  const [confirming, setConfirming] = useState(false);
  const reset = useResetCounterSequence();

  const handleConfirm = async () => {
    try {
      await reset.mutateAsync(counter.id);
      toast.success(
        t("Queue:Reset:Done", previewNumber(counter.numberPrefix, counter.startNumber)),
      );
      setConfirming(false);
    } catch {
      // queryClient reports the failure; the confirm stays open to retry.
    }
  };

  return (
    <div className="queue-reset">
      <div className="bd-min0">
        <div className="queue-reset__title">{t("Queue:Reset:Title")}</div>
        <div className="queue-reset__state">
          {counter.lastIssuedNumber
            ? t("Queue:Reset:IssuedUpTo", counter.lastIssuedNumber, counter.inQueueCount)
            : t("Queue:Reset:NothingIssued")}
        </div>
      </div>
      <Button
        danger
        className="queue-reset__button"
        onClick={() => setConfirming(true)}
        disabled={!counter.lastIssuedNumber}
      >
        {t("Queue:Reset:Button")}
      </Button>
      <ConfirmDialog
        open={confirming}
        message={t("Queue:Reset:Confirm", previewNumber(counter.numberPrefix, counter.startNumber))}
        pending={reset.isPending}
        onConfirm={() => void handleConfirm()}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
