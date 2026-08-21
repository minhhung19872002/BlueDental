import React, { useState } from "react";
import { Segmented, Button, Space, Typography } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

export const DateViewSelector: React.FC = () => {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [currentDate, setCurrentDate] = useState(dayjs());

  const handlePrev = () => {
    if (viewMode === "day") setCurrentDate(currentDate.subtract(1, "day"));
    else if (viewMode === "week") setCurrentDate(currentDate.subtract(1, "week"));
    else setCurrentDate(currentDate.subtract(1, "month"));
  };

  const handleNext = () => {
    if (viewMode === "day") setCurrentDate(currentDate.add(1, "day"));
    else if (viewMode === "week") setCurrentDate(currentDate.add(1, "week"));
    else setCurrentDate(currentDate.add(1, "month"));
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
  };

  const formatDateDisplay = () => {
    if (viewMode === "day") {
      const isToday = currentDate.isSame(dayjs(), "day");
      return `${isToday ? "Hôm nay " : ""}(${currentDate.format("DD/MM/YYYY")})`;
    }
    if (viewMode === "week") {
      const start = currentDate.startOf("week").format("DD/MM");
      const end = currentDate.endOf("week").format("DD/MM/YYYY");
      return `Tuần (${start} - ${end})`;
    }
    return `Tháng ${currentDate.format("MM/YYYY")}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        background: "#FFFFFF",
        padding: "8px 16px",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
      }}
    >
      <Segmented
        value={viewMode === "day" ? "Ngày" : viewMode === "week" ? "Tuần" : "Tháng"}
        onChange={(val) => {
          if (val === "Ngày") setViewMode("day");
          else if (val === "Tuần") setViewMode("week");
          else setViewMode("month");
        }}
        options={["Ngày", "Tuần", "Tháng"]}
        style={{ fontWeight: 600 }}
      />

      <Space size={8} align="center">
        <Button
          size="small"
          icon={<LeftOutlined style={{ fontSize: 12 }} />}
          onClick={handlePrev}
          style={{ borderRadius: 6 }}
        />

        <Button
          size="small"
          onClick={handleToday}
          style={{ fontWeight: 600, borderRadius: 6, color: "#2671D8" }}
        >
          Hôm nay
        </Button>

        <Button
          size="small"
          icon={<RightOutlined style={{ fontSize: 12 }} />}
          onClick={handleNext}
          style={{ borderRadius: 6 }}
        />

        <Space size={6} style={{ marginLeft: 4 }}>
          <CalendarOutlined style={{ color: "#2671D8", fontSize: 16 }} />
          <Text strong style={{ color: "#0F172A", fontSize: 14 }}>
            {formatDateDisplay()}
          </Text>
        </Space>
      </Space>
    </div>
  );
};
