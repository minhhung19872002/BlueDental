import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { useExportReceipt, useStoredReceiptPdf, type ReceiptSignMode } from "../api/paymentReceiptApi";
import { receiptSigningKeys } from "../api/receiptSigningApi";

/**
 * "Xuất phiếu thu" on the receipt page (P2610 phase 5): the accountant picks
 * Ký số or Không ký số, the server writes the signed PHIẾU THU once, and the
 * stored file opens in a new tab — the same file "In phiếu thu" prints from
 * then on. The tab opens on the click itself so it is not taken for a popup.
 * Failures are toasted by the global MutationCache.
 */
export function useReceiptExport(paymentId: string) {
  const queryClient = useQueryClient();
  const exportReceipt = useExportReceipt(paymentId);
  const storedPdf = useStoredReceiptPdf();
  const [signMode, setSignMode] = useState<ReceiptSignMode | null>(null);

  const showStored = (tab: Window | null) => {
    storedPdf.mutate(paymentId, {
      onSuccess: (blob) => showReceipt(tab, blob),
      onError: () => tab?.close(),
    });
  };

  const handleExport = () => {
    if (signMode === null) return;
    const tab = openReceiptTab();
    exportReceipt.mutate(signMode, {
      onSuccess: () => {
        toast.success(t("Receipt:Export:Done"));
        void queryClient.invalidateQueries({ queryKey: receiptSigningKeys.detail(paymentId) });
        showStored(tab);
      },
      onError: () => tab?.close(),
    });
  };

  const handlePrintStored = () => showStored(openReceiptTab());

  return {
    signMode,
    setSignMode,
    exporting: exportReceipt.isPending,
    printingStored: storedPdf.isPending,
    exportReceipt: handleExport,
    printStored: handlePrintStored,
  };
}
