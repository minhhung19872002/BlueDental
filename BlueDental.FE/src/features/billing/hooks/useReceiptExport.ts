import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { downloadBlob } from "@/utils/download";
import {
  RECEIPT_SIGN_MODE,
  useExportReceipt,
  useStoredReceiptPdf,
  type ReceiptSignMode,
} from "../api/paymentReceiptApi";
import { receiptSigningKeys } from "../api/receiptSigningApi";

/**
 * "Xuất phiếu thu" on the receipt page (P2610 phase 5, P2910_02): the
 * accountant picks Ký điện tử, Token or Ký tay, the server writes the PHIẾU THU once, and the
 * stored file opens in a new tab while the page stays — the same file "In
 * phiếu" prints and "Tải PDF" saves from then on. The tab opens on the click itself so it is not taken for a popup.
 * Failures are toasted by the global MutationCache.
 */
export function useReceiptExport(paymentId: string) {
  const queryClient = useQueryClient();
  const exportReceipt = useExportReceipt(paymentId);
  const storedPdf = useStoredReceiptPdf();
  const storedDownload = useStoredReceiptPdf();
  // Ký điện tử comes picked (P2910_02 mock): the saved signature is used again.
  const [signMode, setSignMode] = useState<ReceiptSignMode>(RECEIPT_SIGN_MODE.Electronic);

  const showStored = (tab: Window | null) => {
    storedPdf.mutate(paymentId, {
      onSuccess: (blob) => showReceipt(tab, blob),
      onError: () => tab?.close(),
    });
  };

  const handleExport = () => {
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

  const handleDownloadStored = (fileName: string) =>
    storedDownload.mutate(paymentId, { onSuccess: (blob) => downloadBlob(blob, fileName) });

  return {
    signMode,
    setSignMode,
    exporting: exportReceipt.isPending,
    printingStored: storedPdf.isPending,
    downloadingStored: storedDownload.isPending,
    exportReceipt: handleExport,
    printStored: handlePrintStored,
    downloadStored: handleDownloadStored,
  };
}

export type ReceiptExporter = ReturnType<typeof useReceiptExport>;
