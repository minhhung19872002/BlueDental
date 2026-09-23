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
  const pageLines = lines.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("Treatment:Service:ServiceNoun"));
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
            <th>{t("Treatment:Service:Service")}</th>
            <th className="pdt-num">{t("Treatment:Pricing:TotalAmount")}</th>
            <th className="pdt-num">{t("Treatment:Receipt:TotalPaid")}</th>
            <th className="pdt-num">{t("Treatment:Debt:Remaining")}</th>
            <th className="pdt-num">{t("Treatment:Refund:Refunded")}</th>
            <th className="pdt-refund-input">{t("Treatment:Refund:EnterAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {/* An empty refund keeps its table: the reference never swaps the grid
              for a bare sentence, it prints the head and one "no data" row. */}
          {pageLines.length === 0 && (
            <tr>
              <td colSpan={6} className="pdt-refund-empty">
                {t("Treatment:Common:NoData")}
              </td>
            </tr>
          )}
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
                    aria-label={t("Treatment:Refund:AmountLabel", name)}
                    placeholder={t("Treatment:Refund:EnterAmount")}
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
      {lines.length > 0 && (
        <Pagination
          className="pdt-refund-pager"
          {...pagination.buildConfig(lines.length, showTotal)}
        />
      )}
    </div>
  );
}
