import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiErrorData, extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyApiError } from "@/lib/notify";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import {
  useIssueEInvoice,
  useRenderPaymentReceipt,
  type EInvoiceSource,
  type ElectronicInvoiceLineInput,
  type IssueElectronicInvoiceInput,
} from "../api/eInvoiceApi";
import { buyerFieldOf, type BuyerField, type BuyerServerError } from "./redInvoiceRules";

type Buyer = Omit<IssueElectronicInvoiceInput, keyof EInvoiceSource | "send" | "lines">;

interface Options {
  source: EInvoiceSource;
  buildBuyer: () => Buyer;
  buildLines: () => ElectronicInvoiceLineInput[];
  /** Whether the buyer fields "Xuất hóa đơn đỏ" needs are all filled. */
  redInvoiceComplete: boolean;
  /** Whether what is typed passes EasyInvoice's format rules (Mã số thuế). */
  buyerFormatValid: boolean;
  onClose: () => void;
}

/** The request property each buyer box fills (IssueElectronicInvoiceInput). */
const SENT_PROPERTY: Record<BuyerField, keyof Buyer> = {
  customerName: "buyerName",
  companyName: "companyName",
  address: "address",
  taxCode: "taxCode",
  phone: "phone",
  email: "email",
};

/**
 * The dialog's two buttons.
 *
 * - Lưu Nháp keeps the form in BlueDental only (Nháp): nothing is sent or
 *   printed and nothing is required, so it can be finished later (BA 2026-11-18).
 * - Lưu opens the PHIẾU THU in a new tab. With "Xuất hóa đơn đỏ" ticked it
 *   also sends the e-invoice to EasyInvoice unsigned (Chờ kiểm tra) for the
 *   accountant to check and sign on the portal, and the tab opens only once
 *   EasyInvoice took it: a refusal leaves just the dialog, to correct the
 *   data and press Lưu again. Ticked, Tên khách hàng, Mã số thuế, Địa chỉ,
 *   Số ĐT and Email are required and the Mã số thuế must pass EasyInvoice's rule
 *   (R-1245): Lưu then stops and flags the boxes under their fields.
 * - A refusal the server ties to one box (data.Field) shows under that box.
 */
export function useInvoiceIssue({ source, buildBuyer, buildLines, redInvoiceComplete, buyerFormatValid, onClose }: Options) {
  const [serverError, setServerError] = useState<BuyerServerError | null>(null);
  const handleIssueError = useCallback((error: unknown, input: IssueElectronicInvoiceInput) => {
    const field = buyerFieldOf(apiErrorData(error, "Field"));
    if (field === undefined) {
      notifyApiError(error);
      return;
    }
    setServerError({
      field,
      message: apiErrorData(error, "Message") ?? extractApiError(error),
      sentValue: (input[SENT_PROPERTY[field]] ?? "").toString().trim(),
    });
  }, []);

  const issue = useIssueEInvoice(handleIssueError);
  const receipt = useRenderPaymentReceipt();
  const [redInvoice, setRedInvoice] = useState(false);
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [formatChecked, setFormatChecked] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  const handleRedInvoiceChange = useCallback((checked: boolean) => {
    setRedInvoice(checked);
    if (!checked) setRequiredChecked(false);
  }, []);

  const saveDraft = useCallback(() => {
    setServerError(null);
    issue.mutate(
      { ...source, send: false, ...buildBuyer(), lines: buildLines() },
      {
        onSuccess: () => {
          toast.success(t("Treatment:EInvoice:DraftSaved"));
          onClose();
        },
      },
    );
  }, [issue, source, buildBuyer, buildLines, onClose]);

  const publish = useCallback(async () => {
    // Unticked nothing can be refused, so the tab opens while the click is
    // still the user's. Ticked it waits for EasyInvoice's answer and opens then.
    const tab = redInvoice ? null : openReceiptTab();
    const buyer = buildBuyer();
    const lines = buildLines();
    setServerError(null);
    const [pdf, invoice] = await Promise.allSettled([
      receipt.mutateAsync({ ...source, buyerName: buyer.buyerName, arisingDate: buyer.arisingDate, lines }),
      redInvoice ? issue.mutateAsync({ ...source, send: true, ...buyer, lines }) : Promise.resolve(null),
    ]);
    setConfirmingPublish(false);

    if (pdf.status === "fulfilled" && invoice.status === "fulfilled") showReceipt(tab, pdf.value);
    else tab?.close();

    // Sent, it waits for the accountant on the portal, so the dialog has done
    // its job; otherwise it stays open to correct the data and print again.
    if (invoice.status === "fulfilled" && invoice.value !== null) {
      toast.success(t("Treatment:EInvoice:Sent"));
      onClose();
    }
  }, [receipt, issue, redInvoice, source, buildBuyer, buildLines, onClose]);

  const handleIssueClick = useCallback(() => {
    if (!redInvoice) {
      void publish();
      return;
    }
    setRequiredChecked(true);
    setFormatChecked(true);
    if (redInvoiceComplete && buyerFormatValid) setConfirmingPublish(true);
  }, [redInvoice, redInvoiceComplete, buyerFormatValid, publish]);

  return {
    redInvoice,
    onRedInvoiceChange: handleRedInvoiceChange,
    /** Errors show only after a Lưu with the box ticked, as a form's do after submit. */
    showRequiredErrors: redInvoice && requiredChecked,
    /** Format errors show once a ticked Lưu was pressed. */
    showFormatErrors: redInvoice && formatChecked,
    serverError,
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
