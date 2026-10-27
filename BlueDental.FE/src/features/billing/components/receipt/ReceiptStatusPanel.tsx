import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "antd";
import { Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import { RECEIPT_STATUS, type PaymentReceiptDto } from "../../api/paymentReceiptApi";
import { cancelReasonText } from "./receiptStatus";

interface Props {
  receipt: PaymentReceiptDto;
  /** The slip's Thanh toán tab: Sửa, Huỷ and ✓ live there for now. */
  slipPath: string;
  /** Left out while the signed receipt waits on the accountant's export. */
  print?: { run: () => void; pending: boolean };
  /** While the receipt waits: where the iPad stands, replacing "Chờ gửi tới iPad". */
  pendingTitle?: string;
  /** While the receipt waits: the iPad callout under the heading. */
  notice?: ReactNode;
  /** While the receipt waits: the iPad buttons, in the foot row before "In phiếu thu". */
  actions?: ReactNode;
  /** Once signed: the main button, beside Yêu cầu khách ký lại (Xuất phiếu thu). */
  primary?: ReactNode;
  /** While the receipt waits: what the accountant does next (Xuất phiếu thu). */
  children?: ReactNode;
}

interface PanelView {
  title: string;
  body: ReactNode;
}

const dash = (value: string | null) => value || "—";
const when = (value: string | null) => (value ? formatDateTime(value) : "—");

/** What the panel says while the receipt waits on the iPad. */
const pendingView = (slipLink: ReactNode): PanelView => ({
  title: t("Receipt:Panel:PendingTitle"),
  body: (
    <>
      <p>{t("Receipt:Panel:PendingText")}</p>
      {slipLink}
    </>
  ),
});

/** What the panel says once the receipt is cancelled: who, when and why. */
const cancelledView = (receipt: PaymentReceiptDto): PanelView => ({
  title: t("Treatment:Payment:Cancelled"),
  body: (
    <>
      <p>{t("Treatment:Payment:CancelledBy", dash(receipt.cancelledByName), when(receipt.cancelledAt))}</p>
      <p>{t("Treatment:Payment:CancelReasonShown", cancelReasonText(receipt.cancelReasonCode, receipt.cancelReason))}</p>
    </>
  ),
});

/**
 * The column beside the sheet: its heading, where the iPad stands, what the
 * receipt's state means, then the buttons in one row at the foot. A written
 * receipt waits here on the customer's iPad; it is still corrected or
 * cancelled on the slip. A waiting receipt can be printed, except while the
 * signed one waits on its export (the BA mock). Exported and paid receipts
 * have ReceiptExportedPanel instead.
 */
export function ReceiptStatusPanel({ receipt, slipPath, print, pendingTitle, notice, actions, primary, children }: Props) {
  const slipLink = (
    <Link className="rcpt-panel-link" to={slipPath}>
      {t("Receipt:Panel:OpenSlip", receipt.content.planCode)}
    </Link>
  );
  const cancelled = receipt.status === RECEIPT_STATUS.Cancelled;
  const view = cancelled ? cancelledView(receipt) : pendingView(slipLink);
  const title = !cancelled && pendingTitle ? pendingTitle : view.title;
  return (
    <aside className="rcpt-panel" aria-label={t("Common:Status")}>
      <h3 className="rcpt-panel-title">{title}</h3>
      {notice}
      <div className="rcpt-panel-body">{view.body}</div>
      {children}
      <div className="rcpt-panel-actions">
        {actions}
        {primary}
        {print && !cancelled && (
          <Button
            className="rcpt-panel-print"
            onClick={print.run}
            loading={print.pending}
            icon={<Printer size={16} aria-hidden="true" />}
          >
            {t("Treatment:Payment:PrintReceipt")}
          </Button>
        )}
      </div>
    </aside>
  );
}
