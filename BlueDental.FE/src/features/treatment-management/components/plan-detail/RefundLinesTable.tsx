import { Pagination } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { moneyText } from "../plan/planTypes";
import { RefundLineCards } from "./RefundLineCards";
import type { RefundLine } from "./useRefundForm";

const NARROW_SCREEN = "(max-width: 640px)";

interface Props {
  lines: RefundLine[];
  onAmountChange: (serviceId: string, amount: number | undefined) => void;
}

/**
 * The service table of the refund dialog: every paid line with what it can
 * still give back and a box for the amount, paged like production. Under
 * 640px it becomes the numbered cards of the other tabs.
 */
export function RefundLinesTable({ lines, onAmountChange }: Props) {
  const pagination = useTablePagination(20);
  const narrow = useMediaQuery(NARROW_SCREEN);
  if (lines.length === 0) {
    return <p className="pdt-refund-empty">{t("Phiếu này chưa có dịch vụ nào được thanh toán")}</p>;
  }
  const pageLines = lines.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("dịch vụ"));
  if (narrow) {
    return (
      <RefundLineCards
        lines={pageLines}
        total={lines.length}
        pagination={pagination}
        onAmountChange={onAmountChange}
        showTotal={showTotal}
      />
    );
  }
  return (
    <div className="pdt-refund-table-wrap">
      <table className="pdt-refund-table">
        <thead>
          <tr>
            <th>{t("Dịch vụ")}</th>
            <th className="pdt-num">{t("Tổng tiền")}</th>
            <th className="pdt-num">{t("Đã thanh toán")}</th>
            <th className="pdt-num">{t("Còn lại")}</th>
            <th className="pdt-num">{t("Đã hoàn")}</th>
            <th className="pdt-refund-input">{t("Nhập số tiền hoàn")}</th>
          </tr>
        </thead>
        <tbody>
          {pageLines.map((line) => {
            const name = line.service.serviceName ?? line.service.code;
            const over = (line.amount ?? 0) > line.refundable;
            return (
              <tr key={line.service.id} className={over ? "pdt-refund-row--over" : undefined}>
                <td>{name}</td>
                <td className="pdt-num">{moneyText(line.service.effectiveAmount)}</td>
                <td className="pdt-num">{moneyText(line.paid)}</td>
                <td className="pdt-num">{moneyText(line.service.outstandingAmount)}</td>
                <td className="pdt-num">{moneyText(line.refunded)}</td>
                <td className="pdt-refund-input">
                  <CurrencyInput
                    aria-label={t("Số tiền hoàn {0}", name)}
                    placeholder={t("Nhập số tiền hoàn")}
                    value={line.amount}
                    onChange={(amount) => onAmountChange(line.service.id, amount)}
                    disabled={line.refundable <= 0}
                    status={over ? "error" : undefined}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination className="pdt-refund-pager" {...pagination.buildConfig(lines.length, showTotal)} />
    </div>
  );
}
