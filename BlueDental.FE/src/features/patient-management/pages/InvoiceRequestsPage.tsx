import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useRefreshInvoiceRequests } from "../api/invoiceRequestApi";
import { InvoiceRequestPanel } from "../components/patient-detail/invoice-request/InvoiceRequestPanel";

/**
 * Tài chính › Hóa đơn đỏ (P1811): every customer's Yêu cầu xuất HĐ of the
 * branch in the header, worked here (Xử lý / Xử lý lại / Hủy yêu cầu) but
 * only ever raised from a patient's Hóa đơn tab or the customer's QR.
 */
export function InvoiceRequestsPage() {
  const clinicBranchId = useCurrentBranchId();
  const { refresh, refreshing } = useRefreshInvoiceRequests();
  const actions = (
    <Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh}>
      {t("Common:Refresh")}
    </Button>
  );
  return (
    <div className="page-container">
      <PageHeader title={t("Menu:InvoiceRequests")} actions={actions} />
      <InvoiceRequestPanel scope={{ clinicBranchId }} />
    </div>
  );
}
