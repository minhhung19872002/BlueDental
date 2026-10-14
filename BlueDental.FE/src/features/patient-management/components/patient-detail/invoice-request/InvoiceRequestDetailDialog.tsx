import { PrinterOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { InvoiceRequestDto } from "../../../api/invoiceRequestApi";
import { InvoiceRequestDetailActions, type InvoiceRequestDetailHandlers } from "./InvoiceRequestDetailActions";
import { InvoiceRequestSheet } from "./InvoiceRequestSheet";
import { InvoiceRequestStatusTag } from "./InvoiceRequestStatusTag";
import { printInvoiceRequest } from "./printInvoiceRequest";

/** Where the request stands — on screen only; the paper form has no room for it. */
function RequestMeta({ request }: { request: InvoiceRequestDto }) {
  return (
    <div className="ir-detail-meta">
      <span className="ir-detail-meta__code">{request.code}</span>
      <span>{formatDateTime(request.requestedAt)}</span>
      <span>
        {t("Patient:InvoiceRequest:Field:Receipt")}: <b>{request.paymentCode}</b>
      </span>
      <InvoiceRequestStatusTag status={request.status} />
      {request.invoiceNo && <span>{t("Patient:InvoiceRequest:InvoiceNoShort", request.invoiceNo)}</span>}
      {request.reason && (
        <span className="ir-detail-meta__reason">
          {t("Patient:InvoiceRequest:Field:Reason")}: {request.reason}
        </span>
      )}
    </div>
  );
}

interface Props extends InvoiceRequestDetailHandlers {
  request: InvoiceRequestDto | null;
  onClose: () => void;
}

/** "Chi tiết" on a row: the THÔNG TIN XUẤT HÓA ĐƠN sheet, its workflow buttons and In. */
export function InvoiceRequestDetailDialog({ request, onClose, ...handlers }: Props) {
  return (
    <AppDialog
      open={Boolean(request)}
      width={900}
      className="ir-detail-dialog"
      title={t("Patient:InvoiceRequest:DetailTitle")}
      canSave
      saveLabel={t("Common:Print")}
      saveIcon={<PrinterOutlined />}
      cancelLabel={t("Common:Close")}
      footerLeft={request && <InvoiceRequestDetailActions request={request} {...handlers} />}
      onSave={printInvoiceRequest}
      onClose={onClose}
    >
      {request && (
        <>
          <RequestMeta request={request} />
          <InvoiceRequestSheet request={request} />
        </>
      )}
    </AppDialog>
  );
}
