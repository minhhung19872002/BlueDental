import React from "react";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
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
  countKey: "totalCount" | "waitingCount" | "inProgressCount" | "completedCount";
}

const TAB_CONFIGS: TabConfig[] = [
  { key: "All",            countKey: "totalCount" },
  { key: "WaitingForExam", countKey: "waitingCount" },
  { key: "InProgress",     countKey: "inProgressCount" },
  { key: "Completed",      countKey: "completedCount" },
];

interface CounterConfig {
  key: keyof ReceptionCounters;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

const COUNTER_CONFIGS: CounterConfig[] = [
  { key: "scheduledCount", borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
  { key: "arrivedCount",   borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
  { key: "cancelledCount", borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
  { key: "lateCount",      borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  { key: "temporaryCount", borderColor: "#F97316", bgColor: "#FFEDD5", textColor: "#F97316" },
  { key: "convertedCount", borderColor: "#06B6D4", bgColor: "#CFFAFE", textColor: "#06B6D4" },
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

  const tabLabel: Record<ReceptionStatus, string> = {
    All:            t("Tất cả"),
    WaitingForExam: t("Chờ khám"),
    InProgress:     t("Đang khám"),
    Completed:      t("Hoàn thành"),
  };

  const counterLabel: Record<keyof ReceptionCounters, string> = {
    scheduledCount: t("Đã hẹn"),
    arrivedCount:   t("Đã đến"),
    cancelledCount: t("Huỷ hẹn"),
    lateCount:      t("Trễ hẹn"),
    temporaryCount: t("Lịch tạm"),
    convertedCount: t("Chuyển đổi"),
  };

  return (
    <div className="reception-filter-row">
      {/* Left: status pills + doctor filter */}
      <div className="reception-filter-left">
        <div className="reception-status-pills">
          {TAB_CONFIGS.map((tab) => {
            const count = metrics?.[tab.countKey] ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                data-testid={`reception-metric-${tab.key}`}
                className={`reception-status-pill ${isActive ? "reception-status-pill--active" : ""}`}
                onClick={() => onChange(tab.key)}
              >
                {tabLabel[tab.key]} ({count})
              </button>
            );
          })}
        </div>

        <SearchSelect
          value={selectedDoctorId}
          placeholder={t("Bác sĩ")}
          allowClear
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(val) => onDoctorSelect?.(val)}
          style={{ width: 180 }}
        />
      </div>

      {/* Right: 6 counter cards */}
      <div className="reception-counter-cards">
        {COUNTER_CONFIGS.map((c) => (
          <div
            key={c.key}
            className="reception-counter-card"
            style={{ borderTopColor: c.borderColor, backgroundColor: c.bgColor, color: c.textColor }}
          >
            <span className="reception-counter-value">
              {counters?.[c.key] ?? 0}
            </span>
            <span className="reception-counter-label">{counterLabel[c.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
