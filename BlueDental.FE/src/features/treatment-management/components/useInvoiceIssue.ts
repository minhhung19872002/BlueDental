import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
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

/** Long enough to print or save from the tab; the URL is not needed after that. */
const RECEIPT_URL_LIFETIME_MS = 10 * 60 * 1000;

/**
 * The receipt's tab, opened while the click is still the user's — a tab
 * opened after the PDF arrives would be stopped as a popup. It waits on a
 * "preparing" line until the PDF is pointed at it.
 */
function openReceiptTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) {
    tab.document.title = t("Treatment:PaymentReceipt:Title");
    tab.document.body.textContent = t("Treatment:PaymentReceipt:Preparing");
  }
  return tab;
}

function showReceipt(tab: Window | null, pdf: Blob): void {
  const url = URL.createObjectURL(pdf);
  if (tab) tab.location.href = url;
  else if (!window.open(url, "_blank")) toast.error(t("Treatment:PaymentReceipt:PopupBlocked"));
  window.setTimeout(() => URL.revokeObjectURL(url), RECEIPT_URL_LIFETIME_MS);
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
