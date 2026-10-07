import { Pagination } from "antd";
import { CircleCheck, Eye, FileText, Pencil, Trash2 } from "lucide-react";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import type { PatientPaymentDto } from "../../api/treatmentPlanApi";
import { actionsFor, type PaymentRowActions } from "./paymentColumns";

interface Props {
  payments: PatientPaymentDto[];
  total: number;
  pagination: TablePagination;
  cardRows: (payment: PatientPaymentDto) => { rows: RecordCardRow[]; moreRows: RecordCardRow[] };
  /** Receipts can also be confirmed, corrected and taken back; a refund card only views. */
  actions: PaymentRowActions;
  showTotal: (total: number, range: [number, number]) => string;
}

/** The icon buttons on one card, gated exactly as the table row's are. */
function CardActions({ payment, actions }: { payment: PatientPaymentDto; actions: PaymentRowActions }) {
  const allowed = actionsFor(payment, actions);
  return (
    <>
      <button
        type="button"
        className="bd-rc-action"
        aria-label={t("Treatment:Payment:ViewPaymentFor", payment.code)}
        onClick={() => allowed.onView(payment)}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
      {allowed.onConfirm && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:Payment:ConfirmPaymentFor", payment.code)}
          onClick={() => allowed.onConfirm?.(payment)}
        >
          <CircleCheck size={16} aria-hidden="true" />
        </button>
      )}
      {allowed.onEdit && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:Payment:EditPaymentFor", payment.code)}
          onClick={() => allowed.onEdit?.(payment)}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      )}
      {allowed.onCancel && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:Payment:CancelPaymentFor", payment.code)}
          onClick={() => allowed.onCancel?.(payment)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
      {allowed.onIssueInvoice && allowed.canIssueInvoice?.(payment) !== false && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:EInvoice:Issue")}
          onClick={() => allowed.onIssueInvoice?.(payment)}
        >
          <FileText size={16} aria-hidden="true" />
        </button>
      )}
    </>
  );
}

/** Receipts and refunds at 640px and below: one card per slip, its position on the head. */
export function PaymentCardList({ payments, total, pagination, cardRows, actions, showTotal }: Props) {
  return (
    <div className="tp-card-list pdt-card-list">
      {payments.length === 0 && <p className="bd-rc-empty">{t("Treatment:Common:NoData")}</p>}
      <div className="bd-rc-list">
        {payments.map((payment, position) => {
          const card = cardRows(payment);
          return (
            <RecordCard
              key={payment.id}
              title={String(pagination.skipCount + position + 1)}
              extra={<CardActions payment={payment} actions={actions} />}
              rows={card.rows}
              moreRows={card.moreRows}
            />
          );
        })}
      </div>
      {total > 0 && (
        <Pagination className="tp-card-pager" {...pagination.buildConfig(total, showTotal)} />
      )}
    </div>
  );
}
