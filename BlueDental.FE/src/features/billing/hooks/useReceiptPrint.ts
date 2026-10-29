import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { useReceiptPdf } from "../api/paymentReceiptApi";
import { usePrintReceiptForPaper } from "../api/receiptSigningApi";

/**
 * "In phiếu thu" on a receipt not yet exported. While it waits on the
 * customer it asks first (P2910_02): printing means the customer signs the
 * printout by hand, the iPad session ends, and the accountant's step comes
 * next. The draft PDF opens in a tab opened on the click itself, so it is not
 * taken for a popup. Failures are toasted by the global MutationCache.
 */
export function useReceiptPrint(paymentId: string) {
  const pdf = useReceiptPdf();
  const forPaper = usePrintReceiptForPaper(paymentId);
  const [asking, setAsking] = useState(false);

  const showDraft = (tab: Window | null) =>
    pdf.mutate(paymentId, {
      onSuccess: (blob) => showReceipt(tab, blob),
      onError: () => tab?.close(),
    });

  const handlePrintForPaper = () => {
    const tab = openReceiptTab();
    forPaper.mutate(undefined, {
      onSuccess: () => {
        setAsking(false);
        toast.success(t("Receipt:Paper:Done"));
        showDraft(tab);
      },
      onError: () => tab?.close(),
    });
  };

  return {
    printing: pdf.isPending,
    asking,
    confirming: forPaper.isPending,
    ask: () => setAsking(true),
    dismiss: () => setAsking(false),
    printForPaper: handlePrintForPaper,
    printDraft: () => showDraft(openReceiptTab()),
  };
}

export type ReceiptPrinter = ReturnType<typeof useReceiptPrint>;
