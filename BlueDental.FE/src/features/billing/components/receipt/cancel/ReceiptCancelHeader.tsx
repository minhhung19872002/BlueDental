import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PaymentReceiptDto } from "../../../api/paymentReceiptApi";
import { RECEIPT_STATUS_VIEWS } from "../receiptStatus";

interface Props {
  receipt: PaymentReceiptDto;
  /** The receipt's own page, which the cancel page was opened from. */
  backPath: string;
}

/** The cancel page's head (P2610 mock): ← | Tài chính / Phiếu thu / number over "Hủy phiếu thu" + pill. */
export function ReceiptCancelHeader({ receipt, backPath }: Props) {
  const pill = RECEIPT_STATUS_VIEWS[receipt.status];
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
          <span aria-hidden="true">/</span>
          <span>{receipt.code}</span>
        </nav>
        <div className="rcpt-head-title">
          <h1 className="rcpt-head-code">{t("Receipt:Cancel:Title")}</h1>
          <span className={`rcpt-pill rcpt-pill--${pill.tone}`}>{t(pill.label)}</span>
        </div>
      </div>
    </header>
  );
}
