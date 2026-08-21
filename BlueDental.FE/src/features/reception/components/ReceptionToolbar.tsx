import React from "react";
import { Input, Select, Button, Space } from "antd";
import { SearchOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";

interface DoctorOption {
  id: string;
  name: string;
  title: string;
}

interface ReceptionToolbarProps {
  keyword?: string;
  selectedDoctorId?: string;
  doctors?: DoctorOption[];
  onSearchChange: (value: string) => void;
  onDoctorSelect: (doctorId: string | undefined) => void;
  onCreateClick: () => void;
}

export const ReceptionToolbar: React.FC<ReceptionToolbarProps> = ({
  keyword = "",
  selectedDoctorId,
  doctors = [],
  onSearchChange,
  onDoctorSelect,
  onCreateClick,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Space size={12} wrap style={{ flex: 1, minWidth: 280 }}>
        <Input
          placeholder="Nhập từ khoá tìm kiếm"
          prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{
            width: 280,
            height: 40,
            borderRadius: 8,
            borderColor: "#DCE3EE",
          }}
        />

        <Select
          placeholder="Chọn nhân sự"
          value={selectedDoctorId}
          onChange={(val) => onDoctorSelect(val)}
          allowClear
          suffixIcon={<UserOutlined style={{ color: "#94A3B8" }} />}
          style={{ width: 220, height: 40 }}
          options={doctors.map((d) => ({
            value: d.id,
            label: d.name,
          }))}
        />
      </Space>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onCreateClick}
        style={{
          height: 40,
          borderRadius: 8,
          backgroundColor: "#2671D8",
          borderColor: "#2671D8",
          fontWeight: 600,
          paddingLeft: 20,
          paddingRight: 20,
          boxShadow: "0 2px 8px rgba(38, 113, 216, 0.25)",
        }}
      >
        Tạo tiếp nhận
      </Button>
    </div>
  );
};
