import { useQueries } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PaymentStatSummaryDto } from "@/features/report/api/clinicReportApi";

/** How many days the dashboard's revenue bars cover, today included. */
export const REVENUE_DAYS = 8;

export interface RevenueBar {
  /** ISO day the bar stands for. */
  date: string;
  /** Weekday initial(s), as the design labels its axis. */
  weekday: string;
  amount: number;
}

/**
 * One payment-stat call per day, because the report endpoint summarises a range
 * rather than returning a series. Eight small cached reads beat inventing a
 * number the backend cannot back up.
 */
export function useRevenueSeries(): { bars: RevenueBar[]; isLoading: boolean } {
  const clinicBranchId = useCurrentBranchId();

  const days = Array.from({ length: REVENUE_DAYS }, (_, i) =>
    dayjs().subtract(REVENUE_DAYS - 1 - i, "day"),
  );

  const results = useQueries({
    queries: days.map((day) => {
      const date = day.format("YYYY-MM-DD");
      const params = { clinicBranchId, fromDate: date, toDate: date };
      return {
        queryKey: ["clinic-reports", "payment-stat", params] as const,
        queryFn: async () => {
          const res = await api.get<PaymentStatSummaryDto>(
            "/v1/app/clinic-reports/payment-stat",
            { params },
          );
          return res.data;
        },
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  return {
    bars: days.map((day, i) => ({
      date: day.format("YYYY-MM-DD"),
      weekday: day.format("dd"),
      amount: results[i].data?.totalActualReceived ?? 0,
    })),
    isLoading: results.some((r) => r.isLoading),
  };
}
