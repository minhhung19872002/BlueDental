import { Button } from "antd";
import { EditOutlined, LinkOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { INVOICE_REQUEST_STATUS, type InvoiceRequestDto } from "../../../api/invoiceRequestApi";
import type { InvoiceRequestActionKind } from "./InvoiceRequestActionDialog";
import { isOpenStatus } from "./invoiceRequestStatus";

export interface InvoiceRequestDetailHandlers {
  /** Absent when the account may not change a request. */
  onEdit?: () => void;
  onCopyLink?: () => void;
  /** Absent when the account may not move a request along. */
  onStart?: () => void;
  onAction?: (kind: InvoiceRequestActionKind) => void;
  starting: boolean;
  copying: boolean;
}

interface Props extends InvoiceRequestDetailHandlers {
  request: InvoiceRequestDto;
}

/**
 * The buttons left of "In" in the detail footer. A closed request (Đã xuất,
 * Đã hủy) keeps none; Hoàn tất only follows Xử lý.
 */
export function InvoiceRequestDetailActions({ request, onEdit, onCopyLink, onStart, onAction, starting, copying }: Props) {
  if (!isOpenStatus(request.status)) return null;
  const { status } = request;
  const canStart = status !== INVOICE_REQUEST_STATUS.Processing;
  const canAskMore = status !== INVOICE_REQUEST_STATUS.NeedsInfo;

  return (
    <div className="ir-detail-actions">
      {onEdit && (
        <Button icon={<EditOutlined />} onClick={onEdit}>
          {t("Common:Edit")}
        </Button>
      )}
      {onCopyLink && (
        <Button icon={<LinkOutlined />} loading={copying} onClick={onCopyLink}>
          {t("Patient:InvoiceRequest:Action:CopyLink")}
        </Button>
      )}
      {onAction && (
        <Button danger onClick={() => onAction("cancel")}>
          {t("Patient:InvoiceRequest:Action:Cancel")}
        </Button>
      )}
      {onAction && canAskMore && (
        <Button onClick={() => onAction("needs-info")}>{t("Patient:InvoiceRequest:Action:NeedsInfo")}</Button>
      )}
      {onStart && canStart && (
        <Button type="primary" ghost loading={starting} onClick={onStart}>
          {t("Patient:InvoiceRequest:Action:Start")}
        </Button>
      )}
      {onAction && status === INVOICE_REQUEST_STATUS.Processing && (
        <Button type="primary" ghost onClick={() => onAction("complete")}>
          {t("Patient:InvoiceRequest:Action:Complete")}
        </Button>
      )}
    </div>
  );
}
