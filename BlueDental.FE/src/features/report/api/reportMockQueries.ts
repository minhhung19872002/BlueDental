// Demo-only hooks: every query resolves from deterministic synthetic data,
// and there are NO mutations — the report page never writes anything.
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  buildBusinessResult,
  buildCashBalance,
  buildCashbookCategories,
  buildCashflowEntries,
  buildCategories,
  buildDailyTotals,
  buildDebtLines,
  buildOverviewStats,
  buildPaymentLines,
  buildPrepaidLines,
  buildRefundLines,
  buildSalesEntries,
  buildSalesSummary,
  buildServiceLines,
  MOCK_DOCTORS,
  MOCK_PATIENT_OPTIONS,
  MOCK_STAFF,
} from "./reportMockData";

const DELAY_MS = 250;
const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

function useMock<T>(key: unknown[], build: () => T) {
  return useQuery({
    queryKey: ["report-mock", ...key],
    queryFn: async () => {
      await wait();
      return build();
    },
    staleTime: Infinity,
  });
}

export interface RangeQuery {
  fromDate: string;
  toDate: string;
  doctorId?: string;
}

export const useMockDoctorOptions = () => useMock(["doctors"], () => MOCK_DOCTORS);
export const useMockStaffOptions = () => useMock(["staff"], () => MOCK_STAFF);
export const useMockPatientOptions = () => useMock(["patients"], () => MOCK_PATIENT_OPTIONS);

export const useMockServiceLines = (q: RangeQuery) =>
  useMock(["service", q], () => buildServiceLines(q.fromDate, q.toDate, q.doctorId));

export const useMockSalesSummary = (q: RangeQuery) =>
  useMock(["summary", q.fromDate, q.toDate], () => buildSalesSummary(q.fromDate, q.toDate));

export const useMockPaymentLines = (q: RangeQuery) =>
  useMock(["payment", q.fromDate, q.toDate], () => {
    const lines = buildPaymentLines(q.fromDate, q.toDate);
    const amounts = lines.map((l) => ({ date: l.date, amount: l.actualReceived }));
    return { lines, daily: buildDailyTotals(q.fromDate, q.toDate, amounts) };
  });

export const useMockRefundLines = (q: RangeQuery) =>
  useMock(["refund", q.fromDate, q.toDate], () => {
    const lines = buildRefundLines(q.fromDate, q.toDate);
    const amounts = lines.map((l) => ({ date: l.date, amount: l.refundAmount }));
    return { lines, daily: buildDailyTotals(q.fromDate, q.toDate, amounts) };
  });

export const useMockDebtLines = (q: RangeQuery) =>
  useMock(["debt", q.fromDate, q.toDate], () => buildDebtLines(q.fromDate, q.toDate));

export const useMockPrepaidLines = (q: RangeQuery) =>
  useMock(["prepaid", q.fromDate, q.toDate], () => buildPrepaidLines(q.fromDate, q.toDate));

export const useMockOverviewStats = () => useMock(["overview"], buildOverviewStats);

export const useMockSalesEntries = (q: RangeQuery) =>
  useMock(["sales-entries", q.fromDate, q.toDate], () => buildSalesEntries(q.fromDate, q.toDate));

export const useMockCategories = () => useMock(["categories"], buildCategories);
export const useMockCashbookCategories = () => useMock(["cashbook-categories"], buildCashbookCategories);
export const useMockCashflowEntries = () => useMock(["cashflow-entries"], buildCashflowEntries);
export const useMockCashBalance = () => useMock(["cash-balance"], buildCashBalance);

export const useMockBusinessResult = (q: RangeQuery) =>
  useMock(["business-result", q.fromDate, q.toDate], () => buildBusinessResult(q.fromDate, q.toDate));

/** Every "save" on the demo report ends here — nothing is persisted. */
export function notifyDemoAction(action: string) {
  toast.info(t("{0} — bản demo, chưa lưu dữ liệu", action));
}
