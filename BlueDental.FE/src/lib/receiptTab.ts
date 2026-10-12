import { toast } from "sonner";
import { t } from "@/lib/i18n";

/** Long enough to print or save from the tab; the URL is not needed after that. */
const RECEIPT_URL_LIFETIME_MS = 10 * 60 * 1000;

/**
 * The receipt's tab, opened while the click is still the user's — a tab
 * opened after the PDF arrives would be stopped as a popup. It waits on a
 * "preparing" line until the PDF is pointed at it.
 */
export function openReceiptTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) {
    tab.document.title = t("Treatment:PaymentReceipt:Title");
    tab.document.body.textContent = t("Treatment:PaymentReceipt:Preparing");
  }
  return tab;
}

/** Points the waiting tab at the PDF, or opens one if the first was blocked. */
export function showReceipt(tab: Window | null, pdf: Blob): void {
  const url = URL.createObjectURL(pdf);
  if (tab) tab.location.href = url;
  else if (!window.open(url, "_blank")) toast.error(t("Treatment:PaymentReceipt:PopupBlocked"));
  window.setTimeout(() => URL.revokeObjectURL(url), RECEIPT_URL_LIFETIME_MS);
}
