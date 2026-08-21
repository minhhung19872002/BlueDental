import React from "react";
import { Tabs, Badge } from "antd";
import type { ReceptionStatus, ReceptionMetrics } from "../types/reception";

interface ReceptionStatusTabsProps {
  activeTab: ReceptionStatus;
  metrics?: ReceptionMetrics;
  onChange: (status: ReceptionStatus) => void;
}

export const ReceptionStatusTabs: React.FC<ReceptionStatusTabsProps> = ({
  activeTab,
  metrics,
  onChange,
}) => {
  const items = [
    {
      key: "Arrived",
      label: (
        <span>
          Khách đến{" "}
          <Badge
            count={metrics?.arrivedCount ?? 0}
            style={{
              backgroundColor: activeTab === "Arrived" ? "#2671D8" : "#94A3B8",
              marginLeft: 6,
            }}
          />
        </span>
      ),
    },
    {
      key: "InProgress",
      label: (
        <span>
          Đang khám{" "}
          <Badge
            count={metrics?.inProgressCount ?? 0}
            style={{
              backgroundColor: activeTab === "InProgress" ? "#F59E0B" : "#94A3B8",
              marginLeft: 6,
            }}
          />
        </span>
      ),
    },
    {
      key: "Completed",
      label: (
        <span>
          Hoàn thành{" "}
          <Badge
            count={metrics?.completedCount ?? 0}
            style={{
              backgroundColor: activeTab === "Completed" ? "#10B981" : "#94A3B8",
              marginLeft: 6,
            }}
          />
        </span>
      ),
    },
    {
      key: "All",
      label: (
        <span>
          Tất cả{" "}
          <Badge
            count={metrics?.totalCount ?? 0}
            style={{
              backgroundColor: activeTab === "All" ? "#64748B" : "#94A3B8",
              marginLeft: 6,
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => onChange(k as ReceptionStatus)}
        items={items}
        style={{ fontWeight: 600 }}
      />
    </div>
  );
};
