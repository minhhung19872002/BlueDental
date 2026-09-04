import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import type { DailyTotalVm } from "../types/mock";

interface Props {
  rows: DailyTotalVm[];
  valueLabel: string;
}

/** Side table on Thanh toán / Hoàn tiền: one row per day of the period, newest first. */
export function DailyTotalsTable({ rows, valueLabel }: Props) {
  return (
    <div className="report-table-card report-daily-card">
      <table className="report-daily-table">
        <thead>
          <tr>
            <th>{t("STT")}</th>
            <th>{t("Ngày")}</th>
            <th className="report-daily-table-amount">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.date}>
              <td>{index + 1}</td>
              <td>{formatDate(row.date)}</td>
              <td className="report-daily-table-amount">
                <span className="report-money">{formatVND(row.amount)} đ</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
