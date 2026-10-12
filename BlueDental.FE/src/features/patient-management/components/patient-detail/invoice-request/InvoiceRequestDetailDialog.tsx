import { PrinterOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { InvoiceRequestDto } from "../../../api/invoiceRequestApi";
import { InvoiceRequestDetailActions, type InvoiceRequestDetailHandlers } from "./InvoiceRequestDetailActions";
import { InvoiceRequestSheet } from "./InvoiceRequestSheet";
import { printInvoiceRequest } from "./printInvoiceRequest";

interface Props extends InvoiceRequestDetailHandlers {
  request: InvoiceRequestDto | null;
  onClose: () => void;
}

/** "Chi tiết" on a row: the THÔNG TIN XUẤT HÓA ĐƠN sheet, its workflow buttons and In. */
export function InvoiceRequestDetailDialog({ request, onClose, ...handlers }: Props) {
  return (
    <AppDialog
      open={Boolean(request)}
      width={760}
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
      {request && <InvoiceRequestSheet request={request} />}
    </AppDialog>
  );
}
