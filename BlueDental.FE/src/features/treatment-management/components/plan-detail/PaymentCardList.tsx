import { Pagination } from "antd";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import type { PatientPaymentDto } from "../../api/treatmentPlanApi";

interface Props {
  payments: PatientPaymentDto[];
  total: number;
  pagination: TablePagination;
  cardRows: (payment: PatientPaymentDto) => { rows: RecordCardRow[]; moreRows: RecordCardRow[] };
  onView: (payment: PatientPaymentDto) => void;
  /** Receipts can also be corrected and taken back; a refund card only views. */
  onEdit?: (payment: PatientPaymentDto) => void;
  onCancel?: (payment: PatientPaymentDto) => void;
  showTotal: (total: number, range: [number, number]) => string;
}

/** Receipts and refunds at 640px and below: one card per slip, its position on the head. */
export function PaymentCardList({
  payments,
  total,
  pagination,
  cardRows,
  onView,
  onEdit,
  onCancel,
  showTotal,
}: Props) {
  return (
    <div className="tp-card-list pdt-card-list">
      {payments.length === 0 && <p className="bd-rc-empty">{t("Không có dữ liệu")}</p>}
      <div className="bd-rc-list">
        {payments.map((payment, position) => {
          const card = cardRows(payment);
          return (
            <RecordCard
              key={payment.id}
              title={String(pagination.skipCount + position + 1)}
              extra={
                <>
                  <button
                    type="button"
                    className="bd-rc-action"
                    aria-label={t("Xem phiếu {0}", payment.code)}
                    onClick={() => onView(payment)}
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  {onEdit && (
                    <button
                      type="button"
                      className="bd-rc-action"
                      aria-label={t("Chỉnh sửa phiếu {0}", payment.code)}
                      onClick={() => onEdit(payment)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  )}
                  {onCancel && (
                    <button
                      type="button"
                      className="bd-rc-action"
                      aria-label={t("Huỷ phiếu {0}", payment.code)}
                      onClick={() => onCancel(payment)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </>
              }
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
