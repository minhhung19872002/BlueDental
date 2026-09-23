import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { useOverviewStats, useSalesSummary, type RangeQuery } from "../api/clinicReportApi";
import { OverviewPieCard } from "./OverviewPieCard";
import { OverviewCard, type OverviewSeriesConfig } from "./OverviewCard";

const VISIT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Report:Overview:NewCustomer"), tone: "gold" },
  { key: "b", label: () => t("Report:Overview:ReturnCustomer"), tone: "green" },
];
const APPOINTMENT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Report:Overview:Scheduled"), tone: "gold" },
  { key: "b", label: () => t("Report:Overview:Arrived"), tone: "green" },
  { key: "c", label: () => t("Report:Overview:Cancelled"), tone: "red" },
];
const PAYMENT_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Report:SubTab:Refund"), tone: "red" },
  { key: "b", label: () => t("Report:Overview:TotalPayment"), tone: "green" },
];
const INCOME_EXPENSE_SERIES: OverviewSeriesConfig[] = [
  { key: "a", label: () => t("Report:Overview:Income"), tone: "green" },
  { key: "b", label: () => t("Report:Overview:Expense"), tone: "red" },
];

interface Props {
  variant?: "full" | "income-expense";
  range: RangeQuery;
}

/** Bottom block of tab 1: pie (Thực thu vs Công nợ) + 2×2 info cards with monthly bars. */
export function ReportOverviewSection({ variant = "full", range }: Props) {
  const { data: stats, isLoading } = useOverviewStats(range);
  const { data: summary } = useSalesSummary(range);

  if (isLoading || !stats) {
    return (
      <div className="reception-card reception-card--content report-overview-loading">
        <Spin />
      </div>
    );
  }

  const incomeExpenseCard = (
    <OverviewCard
      title={t("Report:Overview:IncomeExpenseInfo")}
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
          title={t("Report:Overview:VisitInfo")}
          rows={stats.visits}
          series={stats.visitSeries}
          config={VISIT_SERIES}
        />
        <OverviewCard
          title={t("Report:Overview:AppointmentInfo")}
          rows={stats.appointments}
          series={stats.appointmentSeries}
          config={APPOINTMENT_SERIES}
        />
        <OverviewCard
          title={t("Report:Overview:PaymentInfo")}
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
