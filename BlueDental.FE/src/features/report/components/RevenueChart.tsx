// RevenueChart — bar chart showing monthly revenue.
// TODO: Wire to reporting API and implement with Recharts BarChart.

import { Empty } from "antd";
import { useTranslation } from "react-i18next";

export function RevenueChart() {
  const { t } = useTranslation();
  return <Empty description={t("report.revenueChartInDevelopment")} />;
}
