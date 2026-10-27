import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useCancelReceiptSigning,
  useReceiptSigning,
  useRequestReceiptResign,
  useSendReceiptToDevice,
} from "../api/receiptSigningApi";
import { useReceiptSigningLive } from "./useReceiptSigningLive";

export type IpadAction = "send" | "replace" | "cancel" | "resign";

/**
 * The receipt page's iPad buttons (P2610): Gửi tới iPad / Gửi lại, the
 * "busy" choice of ending the other receipt's session, Hủy phiên & sửa phiếu
 * and Yêu cầu khách ký lại. Failures are toasted by the global MutationCache.
 */
export function useReceiptIpad(paymentId: string) {
  useReceiptSigningLive(paymentId);
  const { data: state, isLoading } = useReceiptSigning(paymentId);
  const send = useSendReceiptToDevice(paymentId);
  const cancel = useCancelReceiptSigning(paymentId);
  const resign = useRequestReceiptResign(paymentId);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const pendingAction: IpadAction | null =
    (send.isPending && (send.variables ? "replace" : "send"))
    || (cancel.isPending && "cancel")
    || (resign.isPending && "resign")
    || null;

  const handleSend = () => {
    send.mutate(false, { onSuccess: () => toast.success(t("Receipt:Ipad:Sent")) });
  };
  const handleReplace = () => {
    send.mutate(true, {
      onSuccess: () => {
        setConfirmReplace(false);
        toast.success(t("Receipt:Ipad:Sent"));
      },
    });
  };
  const handleCancel = () => {
    cancel.mutate(undefined, { onSuccess: () => toast.success(t("Receipt:Ipad:CancelledToast")) });
  };
  const handleResign = () => {
    resign.mutate(undefined, { onSuccess: () => toast.success(t("Receipt:Ipad:ResignToast")) });
  };

  return {
    state: state ?? null,
    /** The first read is on its way: the page waits for it with the receipt. */
    loading: isLoading,
    pendingAction,
    confirmReplace,
    openReplace: () => setConfirmReplace(true),
    closeReplace: () => setConfirmReplace(false),
    send: handleSend,
    replace: handleReplace,
    cancel: handleCancel,
    resign: handleResign,
  };
}
