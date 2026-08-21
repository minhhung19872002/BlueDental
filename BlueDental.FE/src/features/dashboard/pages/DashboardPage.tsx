import { Col, Row } from "antd";
import { TodayAppointmentsCard } from "../components/TodayAppointmentsCard";
import { RevenueSummaryCard } from "../components/RevenueSummaryCard";
import { PendingActionsCard } from "../components/PendingActionsCard";

export function DashboardPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Bảng điều khiển</h1>
          <p className="page-header-subtitle">
            Tổng quan hoạt động phòng khám hôm nay
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
