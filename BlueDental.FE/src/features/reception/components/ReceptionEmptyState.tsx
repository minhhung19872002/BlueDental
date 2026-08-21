import React from "react";
import { Typography, Button } from "antd";
import { InboxOutlined, PlusOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

interface ReceptionEmptyStateProps {
  onCreateClick?: () => void;
}

export const ReceptionEmptyState: React.FC<ReceptionEmptyStateProps> = ({
  onCreateClick,
}) => {
  return (
    <div
      style={{
        padding: "64px 24px",
        textAlign: "center",
        background: "#FFFFFF",
        borderRadius: 16,
        border: "1px dashed #CBD5E1",
        margin: "16px 0",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          color: "#94A3B8",
          fontSize: 32,
        }}
      >
        <InboxOutlined />
      </div>

      <Title level={4} style={{ color: "#334155", margin: "0 0 8px" }}>
        Danh sách trống
      </Title>

      <Text
        type="secondary"
        style={{ display: "block", marginBottom: 20, fontSize: 14, color: "#64748B" }}
      >
        Không có lịch hẹn hoặc hồ sơ tiếp nhận nào trong danh sách hôm nay.
      </Text>

      {onCreateClick && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreateClick}
          style={{
            backgroundColor: "#2671D8",
            borderColor: "#2671D8",
            height: 40,
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Tạo tiếp nhận mới
        </Button>
      )}
    </div>
  );
};
