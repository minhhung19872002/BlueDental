import { Pagination } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import type { RefundLine } from "./useRefundForm";

interface Props {
  lines: RefundLine[];
  total: number;
  pagination: TablePagination;
  onAmountChange: (serviceId: string, amount: number | undefined) => void;
  showTotal: (total: number, range: [number, number]) => string;
}

/** The first four columns stay visible; "Đã hoàn" and the amount box fold behind "Xem thêm". */
function cardRows(line: RefundLine, onAmountChange: Props["onAmountChange"]) {
  const name = line.service.serviceName ?? line.service.code;
  const over = (line.amount ?? 0) > line.refundable;
  const rows: RecordCardRow[] = [
    { key: "service", label: t("Dịch vụ"), value: name },
    { key: "amount", label: t("Tổng tiền"), value: moneyText(line.service.effectiveAmount) },
    { key: "paid", label: t("Đã thanh toán"), value: moneyText(line.paid) },
    { key: "outstanding", label: t("Còn lại"), value: moneyText(line.service.outstandingAmount) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "refunded", label: t("Đã hoàn"), value: moneyText(line.refunded) },
    {
      key: "input",
      label: t("Nhập số tiền hoàn"),
      stacked: true,
      value: (
        <CurrencyInput
          aria-label={t("Số tiền hoàn {0}", name)}
          placeholder={t("Nhập số tiền hoàn")}
          value={line.amount}
          onChange={(amount) => onAmountChange(line.service.id, amount)}
          disabled={line.refundable <= 0}
          status={over ? "error" : undefined}
        />
      ),
    },
  ];
  return { rows, moreRows };
}

/** The refund dialog's service table at 640px and below: one card per paid line, its position on the head. */
export function RefundLineCards({ lines, total, pagination, onAmountChange, showTotal }: Props) {
  return (
    <div className="tp-card-list pdt-card-list pdt-refund-cards">
      <div className="bd-rc-list">
        {lines.map((line, position) => {
          const card = cardRows(line, onAmountChange);
          return (
            <RecordCard
              key={line.service.id}
              title={String(pagination.skipCount + position + 1)}
              rows={card.rows}
              moreRows={card.moreRows}
            />
          );
        })}
      </div>
      <Pagination className="tp-card-pager" {...pagination.buildConfig(total, showTotal)} />
    </div>
  );
}
