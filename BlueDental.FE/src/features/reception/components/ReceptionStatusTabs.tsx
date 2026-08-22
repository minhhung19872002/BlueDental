import React from "react";
import { SearchSelect } from "@/components/SearchSelect";
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
  { key: "WaitingForExam", label: "Chờ khám", countKey: "waitingCount" },
  { key: "InProgress", label: "Đang khám", countKey: "inProgressCount" },
  { key: "Completed", label: "Hoàn thành", countKey: "completedCount" },
];

interface CounterConfig {
  key: keyof ReceptionCounters;
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

const COUNTERS: CounterConfig[] = [
  { key: "scheduledCount", label: "Đã hẹn",     borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
  { key: "arrivedCount",   label: "Đã đến",     borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
  { key: "cancelledCount", label: "Huỷ hẹn",    borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
  { key: "lateCount",      label: "Trễ hẹn",    borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  { key: "temporaryCount", label: "Lịch tạm",   borderColor: "#F97316", bgColor: "#FFEDD5", textColor: "#F97316" },
  { key: "convertedCount", label: "Chuyển đổi", borderColor: "#06B6D4", bgColor: "#CFFAFE", textColor: "#06B6D4" },
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

        <SearchSelect
          value={selectedDoctorId}
          placeholder="Bác sĩ"
          allowClear
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(val) => onDoctorSelect?.(val)}
          style={{ width: 180 }}
        />
      </div>

      {/* Right: 6 counter cards */}
      <div className="reception-counter-cards">
        {COUNTERS.map((c) => (
          <div
            key={c.key}
            className="reception-counter-card"
            style={{ borderTopColor: c.borderColor, backgroundColor: c.bgColor, color: c.textColor }}
          >
            <span className="reception-counter-value">
              {counters?.[c.key] ?? 0}
            </span>
            <span className="reception-counter-label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
