import { Loader2, Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { useRenderPaymentReceipt } from "../../api/eInvoiceApi";
import { printSheet } from "./printSheet";

interface Props {
  /** The receipt to render; null prints the sheet in the dialog instead. */
  paymentId: string | null;
}

/**
 * The footer button of "Chi tiết phiếu". A receipt opens its PHIẾU THU — the
 * same PDF as Lưu, QR included when "Xuất hóa đơn đỏ" was ticked (owner
 * 2026-10-12: "In Hoá Đơn" → "In phiếu thu"). "In hóa đơn tổng" and a refund
 * have no PHIẾU THU and still print the sheet beside the dialog.
 */
export function PrintReceiptButton({ paymentId }: Props) {
  const render = useRenderPaymentReceipt();

  const handlePrint = () => {
    if (!paymentId) {
      printSheet();
      return;
    }
    // Opened inside the click, before any await, or the browser blocks it.
    const tab = openReceiptTab();
    render
      .mutateAsync({ patientPaymentId: paymentId, buyerName: null, arisingDate: null, lines: [] })
      .then((pdf) => showReceipt(tab, pdf))
      // The failure itself is toasted by the global MutationCache.
      .catch(() => tab?.close());
  };

  const Icon = render.isPending ? Loader2 : Printer;
  return (
    <button type="button" className="tp-btn tp-btn--primary" onClick={handlePrint} disabled={render.isPending}>
      <Icon size={16} aria-hidden="true" className={render.isPending ? "pdt-spin" : undefined} />
      {t(paymentId ? "Treatment:Payment:PrintReceipt" : "Treatment:Payment:PrintInvoice")}
    </button>
  );
}
