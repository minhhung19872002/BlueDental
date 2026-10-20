import { Button, type TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";
import {
  INVOICE_REQUEST_SOURCE,
  INVOICE_REQUEST_STATUS,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import { InvoiceRequestStatusTag } from "./InvoiceRequestStatusTag";
import { describeDue, isNewRequest } from "./invoiceRequestStatus";

interface Handlers {
  now: number;
  onDetail: (row: InvoiceRequestDto) => void;
  /** Xử lý / Hoàn tất; left out for an account that may not finalize payments. */
  onStart?: (row: InvoiceRequestDto) => void;
  onComplete?: (row: InvoiceRequestDto) => void;
}

function RequestedCell({ row }: { row: InvoiceRequestDto }) {
  const who = row.source === INVOICE_REQUEST_SOURCE.CustomerQr
    ? t("Patient:InvoiceRequest:ByCustomerQr")
    : row.requesterName ?? "—";
  return (
    <div className="ir-cell">
      <span>{formatDateTime(row.requestedAt)}</span>
      <small>{who}</small>
    </div>
  );
}

/** "Công ty · MST 0101234567" or "Cá nhân". */
function buyerKind(row: InvoiceRequestDto): string {
  if (!row.isCompany) return t("Patient:InvoiceRequest:Personal");
  const company = t("Patient:InvoiceRequest:Company");
  return row.taxCode ? `${company} · ${t("Patient:InvoiceRequest:TaxCodeShort")} ${row.taxCode}` : company;
}

function BuyerCell({ row }: { row: InvoiceRequestDto }) {
  return (
    <div className="ir-cell">
      <strong>{row.isCompany ? row.companyName ?? row.fullName : row.fullName}</strong>
      <small>{buyerKind(row)}</small>
      {/* The contact each kind asks: Email for Công ty, SĐT for Cá nhân (R-916). */}
      <small>{row.isCompany ? row.email : row.phone}</small>
    </div>
  );
}

function StatusCell({ row }: { row: InvoiceRequestDto }) {
  const note = row.status === INVOICE_REQUEST_STATUS.Issued && row.invoiceNo
    ? t("Patient:InvoiceRequest:InvoiceNoShort", row.invoiceNo)
    : row.reason;
  return (
    <div className="ir-cell">
      <InvoiceRequestStatusTag status={row.status} />
      {note && <small className="ir-cell__note">{note}</small>}
    </div>
  );
}

type RowHandlers = Omit<Handlers, "now">;

/** The one action the row offers beside Chi tiết, by where the request stands. */
function primaryAction(row: InvoiceRequestDto, { onDetail, onStart, onComplete }: RowHandlers) {
  if (row.status === INVOICE_REQUEST_STATUS.Pending && onStart) {
    return { label: t("Patient:InvoiceRequest:Action:Start"), run: () => onStart(row) };
  }
  if (row.status === INVOICE_REQUEST_STATUS.Processing && onComplete) {
    return { label: t("Patient:InvoiceRequest:Action:Complete"), run: () => onComplete(row) };
  }
  if (row.status === INVOICE_REQUEST_STATUS.NeedsInfo) {
    return { label: t("Patient:InvoiceRequest:Action:SeeReason"), run: () => onDetail(row) };
  }
  return null;
}

function ActionCell({ row, ...handlers }: RowHandlers & { row: InvoiceRequestDto }) {
  const primary = primaryAction(row, handlers);
  return (
    <div className="ir-actions">
      {primary && (
        <Button size="small" type="primary" ghost onClick={primary.run}>
          {primary.label}
        </Button>
      )}
      <Button size="small" type="link" onClick={() => handlers.onDetail(row)}>
        {t("Common:Detail")}
      </Button>
    </div>
  );
}

/** The columns of the BA mockup, left to right. */
export function buildInvoiceRequestColumns({ now, ...handlers }: Handlers): TableColumnsType<InvoiceRequestDto> {
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
    { title: t("Patient:InvoiceRequest:Col:RequestedAt"), width: 132, render: (_, row) => <RequestedCell row={row} /> },
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
    {
      title: t("Patient:InvoiceRequest:Col:Due"),
      width: 128,
      render: (_, row) => {
        const due = describeDue(row, now);
        return (
          <div className="ir-cell">
            <span className={`ir-due ir-due--${due.tone}`}>{due.text}</span>
            {due.tone !== "none" && <small>{formatDateTime(row.dueAt)}</small>}
          </div>
        );
      },
    },
    {
      title: t("Patient:InvoiceRequest:Col:Assignee"),
      width: 140,
      render: (_, row) => row.assigneeName ?? <span className="ir-muted">{t("Patient:InvoiceRequest:Unassigned")}</span>,
    },
    { title: t("Patient:InvoiceRequest:Col:Status"), width: 128, render: (_, row) => <StatusCell row={row} /> },
    {
      title: t("Common:Actions"),
      width: 170,
      fixed: "right",
      render: (_, row) => <ActionCell row={row} {...handlers} />,
    },
  ];
}
