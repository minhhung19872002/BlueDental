import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatClockSeconds, formatDate } from "@/utils/format";
import type { PaymentReceiptDto } from "../../api/paymentReceiptApi";
import { ledgerMethodLabels } from "../../api/paymentLedgerApi";
import { RECEIPT_STATUS_VIEWS } from "./receiptStatus";

interface Props {
  receipt: PaymentReceiptDto;
  /** The slip's Thanh toán tab, where the receipt was written. */
  backPath: string;
}

/**
 * The page's head (P2610 mock): back to the slip, "Tài chính / Phiếu thu",
 * the receipt's number with its pill, and on the right when it was written,
 * for which slip and how it is paid.
 */
export function ReceiptHeader({ receipt, backPath }: Props) {
  const pill = RECEIPT_STATUS_VIEWS[receipt.status];
  const { content } = receipt;
  return (
    <header className="rcpt-head">
      <Link className="rcpt-back" to={backPath} aria-label={t("Treatment:Common:GoBack")}>
        <ArrowLeft size={16} aria-hidden="true" />
      </Link>
      <div className="rcpt-head-main">
        <nav className="rcpt-crumbs" aria-label={t("Treatment:Common:Breadcrumb")}>
          <span>{t("Menu:FinanceGroup")}</span>
          <span aria-hidden="true">/</span>
          <span>{t("Treatment:PaymentReceipt:Title")}</span>
        </nav>
        <div className="rcpt-head-title">
          <span className="rcpt-head-code">{t("Receipt:Page:Heading", receipt.code)}</span>
          <span className={`rcpt-pill rcpt-pill--${pill.tone}`}>{t(pill.label)}</span>
        </div>
      </div>
      <div className="rcpt-head-meta">
        {t(
          "Receipt:Page:Meta",
          formatDate(receipt.creationTime),
          formatClockSeconds(receipt.creationTime),
          content.planCode,
          ledgerMethodLabels()[content.method],
        )}
      </div>
    </header>
  );
}
