import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { usePayrollPeriod, usePayrollPeriods } from "../api/payrollApi";

/**
 * The month Bảng lương is showing and its sheet, if the branch has one. A
 * branch has at most one sheet per month, so the month picks it.
 */
export function usePayrollMonth() {
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf("month"));
  const periods = usePayrollPeriods();
  const summary = periods.data?.find((p) => p.year === month.year() && p.month === month.month() + 1);
  const period = usePayrollPeriod(summary?.id);

  return {
    month,
    setMonth,
    label: month.format("MM/YYYY"),
    period: summary ? period.data : undefined,
    loading: periods.isLoading || (Boolean(summary) && period.isLoading),
  };
}
