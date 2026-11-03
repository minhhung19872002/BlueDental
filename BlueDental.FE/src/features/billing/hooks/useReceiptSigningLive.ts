import { useEffect, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { createNotificationConnection } from "@/lib/signalr";
import { paymentReceiptKeys } from "../api/paymentReceiptApi";
import { receiptSigningKeys } from "../api/receiptSigningApi";

/**
 * While the receipt page is open, what the customer does on the iPad shows at
 * once: the hub names the branch and the receipt, and both are read back.
 */
export function useReceiptSigningLive(paymentId: string): void {
  const queryClient = useQueryClient();
  const idRef = useRef(paymentId);
  idRef.current = paymentId;

  useEffect(() => {
    if (!paymentId) return;

    const connection = createNotificationConnection();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: receiptSigningKeys.detail(idRef.current) });
      void queryClient.invalidateQueries({ queryKey: paymentReceiptKeys.detail(idRef.current) });
    };
    // Any receipt of the branch may free or take the iPad, so every signal
    // re-reads the iPad state; only this receipt's own signal re-reads the sheet.
    const handleChanged = (_branchId: string, changedPaymentId: string) => {
      if (changedPaymentId === idRef.current) refresh();
      else void queryClient.invalidateQueries({ queryKey: receiptSigningKeys.detail(idRef.current) });
    };

    connection.on("ReceiptSigningChanged", handleChanged);
    connection.onreconnected(refresh);
    connection.start().catch((error: unknown) => {
      console.warn("Receipt signing live updates unavailable:", error);
    });

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [paymentId, queryClient]);
}
