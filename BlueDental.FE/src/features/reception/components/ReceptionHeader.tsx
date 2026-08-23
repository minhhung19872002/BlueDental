import React from "react";
import { Card, Row, Col, Typography, Statistic, Space } from "antd";
import {
  UserAddOutlined,
  UsergroupAddOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { DateViewSelector } from "./DateViewSelector";
import type { ReceptionMetrics } from "../types/reception";
import { t } from "@/lib/i18n";

const { Title, Text } = Typography;

interface ReceptionHeaderProps {
  metrics?: ReceptionMetrics;
  loading?: boolean;
}

export const ReceptionHeader: React.FC<ReceptionHeaderProps> = ({
  metrics,
  loading = false,
}) => {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top Title & Date Control Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              color: "#64748B",
              textTransform: "uppercase",
            }}
          >
            {t("TỔNG QUAN")}
          </Text>
          <Title
            level={2}
            style={{ margin: 0, fontWeight: 800, color: "#0F172A", fontSize: 26 }}
          >
            {t("Tiếp nhận khách hàng")}
          </Title>
        </div>

        <DateViewSelector />
      </div>

      {/* 4 Stat Counter Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            loading={loading}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
            }}
            styles={{ body: { padding: "16px 20px" } }}
          >
            <Space align="center" size={16}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "rgba(38, 113, 216, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2671D8",
                  fontSize: 22,
                }}
              >
                <UserAddOutlined />
              </div>
              <Statistic
                title={
                  <Text style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>
                    {t("Khách mới")}
                  </Text>
                }
                value={metrics?.newPatientsCount ?? 0}
                valueStyle={{ fontWeight: 800, fontSize: 24, color: "#0F172A" }}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            loading={loading}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
            }}
            styles={{ body: { padding: "16px 20px" } }}
          >
            <Space align="center" size={16}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "rgba(16, 185, 129, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10B981",
                  fontSize: 22,
                }}
              >
                <UsergroupAddOutlined />
              </div>
              <Statistic
                title={
                  <Text style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>
                    {t("Khách cũ phát sinh")}
                  </Text>
                }
                value={metrics?.oldPatientsCount ?? 0}
                valueStyle={{ fontWeight: 800, fontSize: 24, color: "#0F172A" }}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            loading={loading}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
            }}
            styles={{ body: { padding: "16px 20px" } }}
          >
            <Space align="center" size={16}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "rgba(245, 158, 11, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#F59E0B",
                  fontSize: 22,
                }}
              >
                <CalendarOutlined />
              </div>
              <Statistic
                title={
                  <Text style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>
                    {t("Đã hẹn")}
                  </Text>
                }
                value={metrics?.scheduledCount ?? 0}
                valueStyle={{ fontWeight: 800, fontSize: 24, color: "#0F172A" }}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            loading={loading}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
            }}
            styles={{ body: { padding: "16px 20px" } }}
          >
            <Space align="center" size={16}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "rgba(99, 102, 241, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6366F1",
                  fontSize: 22,
                }}
              >
                <CheckCircleOutlined />
              </div>
              <Statistic
                title={
                  <Text style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>
                    {t("Khách đến")}
                  </Text>
                }
                value={metrics?.arrivedCount ?? 0}
                valueStyle={{ fontWeight: 800, fontSize: 24, color: "#0F172A" }}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
