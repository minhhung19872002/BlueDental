import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import {
  useIssueEInvoice,
  useRenderPaymentReceipt,
  type EInvoiceSource,
  type ElectronicInvoiceLineInput,
  type IssueElectronicInvoiceInput,
} from "../api/eInvoiceApi";

type Buyer = Omit<IssueElectronicInvoiceInput, keyof EInvoiceSource | "publish" | "lines">;

interface Options {
  source: EInvoiceSource;
  buildBuyer: () => Buyer;
  buildLines: () => ElectronicInvoiceLineInput[];
  /** Whether the buyer fields "Xuất hóa đơn đỏ" needs are all filled. */
  redInvoiceComplete: boolean;
  onClose: () => void;
}

/**
 * The dialog's two buttons.
 *
 * - Lưu Nháp only files a draft on EasyInvoice; nothing is printed.
 * - Phát Hành always opens the PHIẾU THU in a new tab. With "Xuất hóa đơn đỏ"
 *   ticked it also signs the e-invoice, and a failure there (shown by the
 *   global error toast) does not hold back the receipt. Ticked, Tên khách
 *   hàng, Mã số thuế, Số ĐT and Email are required: Phát Hành then stops and
 *   flags the blank ones under their fields until they are filled.
 */
export function useInvoiceIssue({ source, buildBuyer, buildLines, redInvoiceComplete, onClose }: Options) {
  const issue = useIssueEInvoice();
  const receipt = useRenderPaymentReceipt();
  const [redInvoice, setRedInvoice] = useState(false);
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  const handleRedInvoiceChange = useCallback((checked: boolean) => {
    setRedInvoice(checked);
    if (!checked) setRequiredChecked(false);
  }, []);

  const saveDraft = useCallback(() => {
    issue.mutate(
      { ...source, publish: false, ...buildBuyer(), lines: buildLines() },
      {
        onSuccess: (invoice) => {
          toast.success(t("Treatment:EInvoice:Issued", invoice.ikey));
          onClose();
        },
      },
    );
  }, [issue, source, buildBuyer, buildLines, onClose]);

  const publish = useCallback(async () => {
    const tab = openReceiptTab();
    const buyer = buildBuyer();
    const lines = buildLines();
    const [pdf, invoice] = await Promise.allSettled([
      receipt.mutateAsync({ ...source, buyerName: buyer.buyerName, arisingDate: buyer.arisingDate, lines }),
      redInvoice ? issue.mutateAsync({ ...source, publish: true, ...buyer, lines }) : Promise.resolve(null),
    ]);
    setConfirmingPublish(false);

    if (pdf.status === "fulfilled") showReceipt(tab, pdf.value);
    else tab?.close();

    // A signed invoice cannot be issued again, so the dialog has done its job;
    // otherwise it stays open to correct the data and print again.
    if (invoice.status === "fulfilled" && invoice.value !== null) {
      toast.success(t("Treatment:EInvoice:Published", invoice.value.no ?? invoice.value.ikey));
      onClose();
    }
  }, [receipt, issue, redInvoice, source, buildBuyer, buildLines, onClose]);

  const handleIssueClick = useCallback(() => {
    if (!redInvoice) {
      void publish();
      return;
    }
    setRequiredChecked(true);
    if (redInvoiceComplete) setConfirmingPublish(true);
  }, [redInvoice, redInvoiceComplete, publish]);

  return {
    redInvoice,
    onRedInvoiceChange: handleRedInvoiceChange,
    /** Errors show only after a Phát Hành with the box ticked, as a form's do after submit. */
    showRequiredErrors: redInvoice && requiredChecked,
    confirmingPublish,
    cancelPublish: () => setConfirmingPublish(false),
    saveDraft,
    onIssueClick: handleIssueClick,
    confirmPublish: publish,
    savingDraft: issue.isPending && !confirmingPublish && !receipt.isPending,
    publishing: receipt.isPending || (issue.isPending && confirmingPublish),
    pending: issue.isPending || receipt.isPending,
  };
}
