import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "antd";
import { Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import { RECEIPT_STATUS, type PaymentReceiptDto, type ReceiptStatus } from "../../api/paymentReceiptApi";
import { cancelReasonText, RECEIPT_STATUS_VIEWS } from "./receiptStatus";

interface Props {
  receipt: PaymentReceiptDto;
  /** The slip's Thanh toán tab: Sửa, Huỷ and ✓ live there for now. */
  slipPath: string;
  onPrint: () => void;
  printing: boolean;
  /** While the receipt waits: where the iPad stands, replacing "Chờ gửi tới iPad". */
  pendingTitle?: string;
  /** While the receipt waits: the iPad buttons. */
  children?: ReactNode;
}

interface PanelView {
  title: string;
  body: ReactNode;
}

const dash = (value: string | null) => value || "—";
const when = (value: string | null) => (value ? formatDateTime(value) : "—");

/** What the panel says, by status (P2610). */
const PANEL_VIEWS: Record<ReceiptStatus, (receipt: PaymentReceiptDto, slipLink: ReactNode, ipad: ReactNode) => PanelView> = {
  [RECEIPT_STATUS.Pending]: (_, slipLink, ipad) => ({
    title: t("Receipt:Panel:PendingTitle"),
    body: (
      <>
        {ipad}
        <p>{t("Receipt:Panel:PendingText")}</p>
        {slipLink}
      </>
    ),
  }),
  [RECEIPT_STATUS.Issued]: (receipt, slipLink) => ({
    title: t("Treatment:Payment:Issued"),
    body: (
      <>
        <p>{t("Receipt:Panel:ExportedBy", dash(receipt.issuedByName), when(receipt.issuedAt))}</p>
        <p>{t("Receipt:Panel:IssuedText")}</p>
        {slipLink}
      </>
    ),
  }),
  [RECEIPT_STATUS.Completed]: (receipt) => ({
    title: t("Treatment:Payment:Completed"),
    body: (
      <>
        <p>{t("Receipt:Panel:ExportedBy", dash(receipt.issuedByName), when(receipt.issuedAt))}</p>
        <p>{t("Receipt:Panel:ConfirmedBy", dash(receipt.confirmedByName))}</p>
      </>
    ),
  }),
  [RECEIPT_STATUS.Cancelled]: (receipt) => ({
    title: t("Treatment:Payment:Cancelled"),
    body: (
      <>
        <p>{t("Treatment:Payment:CancelledBy", dash(receipt.cancelledByName), when(receipt.cancelledAt))}</p>
        <p>{t("Treatment:Payment:CancelReasonShown", cancelReasonText(receipt.cancelReasonCode, receipt.cancelReason))}</p>
      </>
    ),
  }),
};

/**
 * The column beside the sheet: where the receipt stands and what comes next.
 * A written receipt waits here on the customer's iPad; it is still corrected
 * or cancelled on the slip. Every receipt but a cancelled one can be printed.
 */
export function ReceiptStatusPanel({ receipt, slipPath, onPrint, printing, pendingTitle, children }: Props) {
  const slipLink = (
    <Link className="rcpt-panel-link" to={slipPath}>
      {t("Receipt:Panel:OpenSlip", receipt.content.planCode)}
    </Link>
  );
  const view = PANEL_VIEWS[receipt.status](receipt, slipLink, children);
  const title = receipt.status === RECEIPT_STATUS.Pending && pendingTitle ? pendingTitle : view.title;
  return (
    <aside className={`rcpt-panel rcpt-panel--${RECEIPT_STATUS_VIEWS[receipt.status].tone}`} aria-label={t("Common:Status")}>
      <h3 className="rcpt-panel-title">{title}</h3>
      <div className="rcpt-panel-body">{view.body}</div>
      {receipt.status !== RECEIPT_STATUS.Cancelled && (
        <Button
          className="rcpt-panel-print"
          onClick={onPrint}
          loading={printing}
          icon={<Printer size={16} aria-hidden="true" />}
        >
          {t("Treatment:Payment:PrintReceipt")}
        </Button>
      )}
    </aside>
  );
}
