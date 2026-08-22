// ReportPage — /report
// Financial and operational reporting with 4 report tabs.
// Each tab shows summary stat cards with 0 values (stub — real data wired when API is ready).

import { useState } from "react";
import { Tabs, Row, Col } from "antd";

interface ReportTab {
  key: string;
  label: string;
}

interface StatCard {
  label: string;
  value: number;
  suffix?: string;
}

const REPORT_TABS: ReportTab[] = [
  { key: "revenue", label: "Báo cáo doanh thu" },
  { key: "patient-stats", label: "Thống kê bệnh nhân" },
  { key: "treatment", label: "Báo cáo điều trị" },
  { key: "cost", label: "Báo cáo chi phí" },
];

const STAT_CARDS: Record<string, StatCard[]> = {
  revenue: [
    { label: "Doanh thu", value: 0, suffix: "đ" },
    { label: "Lượt khách", value: 0 },
    { label: "Lịch hẹn", value: 0 },
    { label: "Đã thanh toán", value: 0, suffix: "đ" },
  ],
  "patient-stats": [
    { label: "Bệnh nhân mới", value: 0 },
    { label: "Bệnh nhân tái khám", value: 0 },
    { label: "Tổng lượt khách", value: 0 },
    { label: "Tỷ lệ tái khám", value: 0, suffix: "%" },
  ],
  treatment: [
    { label: "Ca điều trị", value: 0 },
    { label: "Đã hoàn thành", value: 0 },
    { label: "Đang điều trị", value: 0 },
    { label: "Hủy điều trị", value: 0 },
  ],
  cost: [
    { label: "Chi phí vật tư", value: 0, suffix: "đ" },
    { label: "Chi phí labo", value: 0, suffix: "đ" },
    { label: "Chi phí khác", value: 0, suffix: "đ" },
    { label: "Tổng chi phí", value: 0, suffix: "đ" },
  ],
};

function StatCardItem({ card }: { card: StatCard }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{card.label}</div>
      <div className="stat-card-value">
        {card.value.toLocaleString("vi-VN")}
        {card.suffix ? <span style={{ fontSize: 16, fontWeight: 600 }}> {card.suffix}</span> : null}
      </div>
    </div>
  );
}

export function ReportPage() {
  const [activeTab, setActiveTab] = useState("revenue");
  const cards = STAT_CARDS[activeTab] ?? [];

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={REPORT_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        <Row gutter={[16, 16]}>
          {cards.map((card) => (
            <Col key={card.label} xs={24} sm={12} md={6}>
              <StatCardItem card={card} />
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
