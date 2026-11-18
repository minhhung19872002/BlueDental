import { Button, type TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";
import {
  INVOICE_REQUEST_STATUS,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import { BuyerCell, CustomerCell, DueCell, StatusCell, TwoLines, requesterOf } from "./InvoiceRequestCells";
import { isNewRequest } from "./invoiceRequestStatus";

export interface InvoiceRequestRowHandlers {
  /** Xử lý / Xử lý lại; left out for an account that may not finalize payments. */
  onProcess?: (row: InvoiceRequestDto) => void;
  /** Hủy yêu cầu, offered once EasyInvoice cancelled the invoice. */
  onWithdraw?: (row: InvoiceRequestDto) => void;
}

interface Options extends InvoiceRequestRowHandlers {
  now: number;
  onDetail: (row: InvoiceRequestDto) => void;
  /** Tài chính › Hóa đơn đỏ lists every customer, so it names whose request it is. */
  showCustomer?: boolean;
}

/** P1811: Mới → Xử lý; Đã hủy → Xử lý lại and Hủy yêu cầu; the rest only Chi tiết. */
function ActionCell({ row, onDetail, onProcess, onWithdraw }: Omit<Options, "now" | "showCustomer"> & { row: InvoiceRequestDto }) {
  const cancelled = row.status === INVOICE_REQUEST_STATUS.Cancelled;
  const canProcess = row.status === INVOICE_REQUEST_STATUS.Pending || cancelled;
  return (
    <div className="ir-actions">
      {onProcess && canProcess && (
        <Button size="small" type="primary" ghost onClick={() => onProcess(row)}>
          {t(cancelled ? "Patient:InvoiceRequest:Action:Reprocess" : "Patient:InvoiceRequest:Action:Process")}
        </Button>
      )}
      {onWithdraw && cancelled && (
        <Button size="small" danger onClick={() => onWithdraw(row)}>
          {t("Patient:InvoiceRequest:Action:Withdraw")}
        </Button>
      )}
      <Button size="small" type="link" onClick={() => onDetail(row)}>
        {t("Common:Detail")}
      </Button>
    </div>
  );
}

/** The columns of the BA mockup, left to right. */
export function buildInvoiceRequestColumns({ now, showCustomer, ...handlers }: Options): TableColumnsType<InvoiceRequestDto> {
  const customer: TableColumnsType<InvoiceRequestDto> = showCustomer
    ? [{ title: t("Patient:InvoiceRequest:Col:Customer"), width: 168, render: (_, row) => <CustomerCell row={row} /> }]
    : [];
  return [
    {
      title: t("Patient:InvoiceRequest:Col:Code"),
      dataIndex: "code",
      width: 104,
      render: (code: string, row) => (
        <div className="ir-cell">
          <strong className="ir-code">{code}</strong>
          {isNewRequest(row, now) && <span className="ir-new">{t("Patient:InvoiceRequest:New")}</span>}
        </div>
      ),
    },
    ...customer,
    { title: t("Patient:InvoiceRequest:Col:RequestedAt"), width: 132, render: (_, row) => <TwoLines top={formatDateTime(row.requestedAt)} bottom={requesterOf(row)} /> },
    {
      title: t("Patient:InvoiceRequest:Col:Payment"),
      width: 200,
      render: (_, row) => (
        <div className="ir-cell">
          <strong>{row.paymentCode}</strong>
          <small className="ir-clamp">{row.serviceName}</small>
        </div>
      ),
    },
    { title: t("Patient:InvoiceRequest:Col:Buyer"), width: 200, render: (_, row) => <BuyerCell row={row} /> },
    {
      title: t("Patient:InvoiceRequest:Col:Amount"),
      dataIndex: "amount",
      width: 112,
      align: "right",
      render: (value: number) => <strong>{formatMoneyUnit(value)}</strong>,
    },
    { title: t("Patient:InvoiceRequest:Col:Due"), width: 128, render: (_, row) => <DueCell row={row} now={now} /> },
    {
      // Who pressed Xử lý, and when (P1811).
      title: t("Patient:InvoiceRequest:Col:Assignee"),
      width: 140,
      render: (_, row) =>
        row.assigneeName ? (
          <TwoLines top={row.assigneeName} bottom={row.processedAt && formatDateTime(row.processedAt)} />
        ) : (
          <span className="ir-muted">{t("Patient:InvoiceRequest:Unassigned")}</span>
        ),
    },
    { title: t("Patient:InvoiceRequest:Col:Status"), width: 128, render: (_, row) => <StatusCell row={row} /> },
    {
      title: t("Common:Actions"),
      width: 260,
      fixed: "right",
      render: (_, row) => <ActionCell row={row} {...handlers} />,
    },
  ];
}
