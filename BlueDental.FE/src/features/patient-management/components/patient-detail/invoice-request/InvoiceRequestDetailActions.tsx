import { Button } from "antd";
import { EditOutlined, LinkOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { INVOICE_REQUEST_STATUS, type InvoiceRequestDto } from "../../../api/invoiceRequestApi";
import { needsAction } from "./invoiceRequestStatus";

export interface InvoiceRequestDetailHandlers {
  /** Absent when the account may not change a request. */
  onEdit?: () => void;
  onCopyLink?: () => void;
  /** Absent when the account may not send or withdraw a request. */
  onProcess?: () => void;
  onWithdraw?: () => void;
  copying: boolean;
}

interface Props extends InvoiceRequestDetailHandlers {
  request: InvoiceRequestDto;
}

/**
 * The buttons left of "In" in the detail footer (P1811): Mới offers Xử lý,
 * Đã hủy offers Xử lý lại and Hủy yêu cầu; Chờ xử lý, Đã xuất HĐ and Đã hủy
 * yêu cầu are view only.
 */
export function InvoiceRequestDetailActions({ request, onEdit, onCopyLink, onProcess, onWithdraw, copying }: Props) {
  if (!needsAction(request.status)) return null;
  const cancelled = request.status === INVOICE_REQUEST_STATUS.Cancelled;

  return (
    <div className="ir-detail-actions">
      {onEdit && (
        <Button icon={<EditOutlined />} onClick={onEdit}>
          {t("Common:Edit")}
        </Button>
      )}
      {onCopyLink && !cancelled && (
        <Button icon={<LinkOutlined />} loading={copying} onClick={onCopyLink}>
          {t("Patient:InvoiceRequest:Action:CopyLink")}
        </Button>
      )}
      {onWithdraw && cancelled && (
        <Button danger onClick={onWithdraw}>
          {t("Patient:InvoiceRequest:Action:Withdraw")}
        </Button>
      )}
      {onProcess && (
        <Button type="primary" ghost onClick={onProcess}>
          {t(cancelled ? "Patient:InvoiceRequest:Action:Reprocess" : "Patient:InvoiceRequest:Action:Process")}
        </Button>
      )}
    </div>
  );
}
