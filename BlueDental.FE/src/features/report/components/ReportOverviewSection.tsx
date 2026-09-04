import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { useMockOverviewStats, useMockSalesSummary, type RangeQuery } from "../api/reportMockQueries";
import { OverviewPieCard } from "./OverviewPieCard";
import { OverviewCard, type OverviewSeriesConfig } from "./OverviewCard";

const VISIT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Khách mới"), tone: "gold" },
  { key: "b", label: () => t("Khách cũ"), tone: "green" },
];
const APPOINTMENT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Đã hẹn"), tone: "gold" },
  { key: "b", label: () => t("Đã đến"), tone: "green" },
  { key: "c", label: () => t("Đã huỷ"), tone: "red" },
];
const PAYMENT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Hoàn tiền"), tone: "red" },
  { key: "b", label: () => t("Tổng thanh toán"), tone: "green" },
];
const INCOME_EXPENSE_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Thu nhập"), tone: "green" },
  { key: "b", label: () => t("Chi phí"), tone: "red" },
];

interface Props {
  /** When set, only the income/expense card is rendered (tab "Quản lý thu chi"). */
  variant?: "full" | "income-expense";
  range: RangeQuery;
}

/** Bottom block of tab 1: pie (Thực thu vs Công nợ) + 2×2 info cards with monthly bars. */
export function ReportOverviewSection({ variant = "full", range }: Props) {
  const { data: stats, isLoading } = useMockOverviewStats();
  const { data: summary } = useMockSalesSummary(range);

  if (isLoading || !stats) {
    return (
      <div className="reception-card reception-card--content report-overview-loading">
        <Spin />
      </div>
    );
  }

  const incomeExpenseCard = (
    <OverviewCard
      title={t("Thông tin thu chi")}
      rows={stats.incomeExpense}
      series={stats.incomeExpenseSeries}
      config={INCOME_EXPENSE_SERIES}
      money
    />
  );

  if (variant === "income-expense") {
    return <div className="report-overview">{incomeExpenseCard}</div>;
  }

  return (
    <div className="report-overview">
      <OverviewPieCard received={summary?.actualReceived ?? 0} debt={summary?.debtIncurred ?? 0} />
      <div className="report-overview-grid">
        <OverviewCard
          title={t("Thông tin lượt khách")}
          rows={stats.visits}
          series={stats.visitSeries}
          config={VISIT_SERIES}
        />
        <OverviewCard
          title={t("Thông tin lịch hẹn")}
          rows={stats.appointments}
          series={stats.appointmentSeries}
          config={APPOINTMENT_SERIES}
        />
        <OverviewCard
          title={t("Thông tin thanh toán")}
          rows={stats.payments}
          series={stats.paymentSeries}
          config={PAYMENT_SERIES}
          money
        />
        {incomeExpenseCard}
      </div>
    </div>
  );
}
