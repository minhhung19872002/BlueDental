import React from "react";
import { Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type {
  ReceptionStatus,
  ReceptionMetrics,
  ReceptionCounters,
} from "../types/reception";

interface DoctorOption {
  id: string;
  name: string;
  title: string;
}

interface ReceptionStatusTabsProps {
  activeTab: ReceptionStatus;
  metrics?: ReceptionMetrics;
  selectedDoctorId?: string;
  doctors?: DoctorOption[];
  onChange: (status: ReceptionStatus) => void;
  onDoctorSelect?: (doctorId: string | undefined) => void;
}

interface TabConfig {
  key: ReceptionStatus;
  label: string;
  countKey: "totalCount" | "waitingCount" | "inProgressCount" | "completedCount";
}

const TABS: TabConfig[] = [
  { key: "All", label: "Tất cả", countKey: "totalCount" },
  { key: "WaitingForExam", label: "Khách đến", countKey: "waitingCount" },
  { key: "InProgress", label: "Đang khám", countKey: "inProgressCount" },
  { key: "Completed", label: "Hoàn thành", countKey: "completedCount" },
];

interface CounterConfig {
  key: keyof ReceptionCounters;
  label: string;
  borderColor: string;
  textColor: string;
}

const COUNTERS: CounterConfig[] = [
  { key: "scheduledCount", label: "Đã hẹn", borderColor: "#52c41a", textColor: "#52c41a" },
  { key: "arrivedCount", label: "Đã đến", borderColor: "#1677ff", textColor: "#1677ff" },
  { key: "cancelledCount", label: "Huỷ hẹn", borderColor: "#faad14", textColor: "#d48806" },
  { key: "lateCount", label: "Trễ hẹn", borderColor: "#ff4d4f", textColor: "#ff4d4f" },
  { key: "temporaryCount", label: "Lịch tạm", borderColor: "#13c2c2", textColor: "#13c2c2" },
  { key: "convertedCount", label: "Chuyển đổi", borderColor: "#597ef7", textColor: "#597ef7" },
];

export const ReceptionStatusTabs: React.FC<ReceptionStatusTabsProps> = ({
  activeTab,
  metrics,
  selectedDoctorId,
  doctors = [],
  onChange,
  onDoctorSelect,
}) => {
  const counters = metrics?.counters;

  return (
    <div className="reception-filter-row">
      {/* Left: status pills + doctor filter */}
      <div className="reception-filter-left">
        <div className="reception-status-pills">
          {TABS.map((tab) => {
            const count = metrics?.[tab.countKey] ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`reception-status-pill ${isActive ? "reception-status-pill--active" : ""}`}
                onClick={() => onChange(tab.key)}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <Select
          placeholder="Bác sĩ"
          value={selectedDoctorId}
          onChange={(val) => onDoctorSelect?.(val)}
          allowClear
          suffixIcon={<SearchOutlined style={{ color: "#94A3B8" }} />}
          style={{ width: 180, height: 34 }}
          options={doctors.map((d) => ({
            value: d.id,
            label: d.name,
          }))}
        />
      </div>

      {/* Right: 6 counter cards */}
      <div className="reception-counter-cards">
        {COUNTERS.map((c) => (
          <div
            key={c.key}
            className="reception-counter-card"
            style={{ borderTopColor: c.borderColor }}
          >
            <span
              className="reception-counter-value"
              style={{ color: c.textColor }}
            >
              {counters?.[c.key] ?? 0}
            </span>
            <span className="reception-counter-label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
