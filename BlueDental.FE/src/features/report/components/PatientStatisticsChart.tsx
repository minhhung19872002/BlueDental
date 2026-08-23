// PatientStatisticsChart — pie/bar chart of patient demographics and visit trends.
// TODO: Wire to reporting API and implement with Recharts.

import { Empty } from "antd";
import { useTranslation } from "react-i18next";

export function PatientStatisticsChart() {
  const { t } = useTranslation();
  return <Empty description={t("report.patientStatsInDevelopment")} />;
}
