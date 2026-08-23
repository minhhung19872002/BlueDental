import { Col, Row } from "antd";
import { useTranslation } from "react-i18next";
import { TodayAppointmentsCard } from "../components/TodayAppointmentsCard";
import { RevenueSummaryCard } from "../components/RevenueSummaryCard";
import { PendingActionsCard } from "../components/PendingActionsCard";

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("dashboard.title")}</h1>
          <p className="page-header-subtitle">
            {t("dashboard.subtitle")}
          </p>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <TodayAppointmentsCard />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <RevenueSummaryCard />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <PendingActionsCard />
        </Col>
      </Row>
    </div>
  );
}
