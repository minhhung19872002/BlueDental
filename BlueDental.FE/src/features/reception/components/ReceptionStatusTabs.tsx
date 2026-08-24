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
  /** Token driving the card's top band and its number. */
  colorVar: string;
}

/**
 * The design colours each counter by status and carries that one colour into
 * both the top band and the number. The values are the brand tokens rather
 * than the Tailwind-ish hexes that were inlined here before.
 */
const COUNTER_CONFIGS: CounterConfig[] = [
  { key: "scheduledCount", colorVar: "var(--bd-blue)" },
  { key: "arrivedCount",   colorVar: "var(--bd-green-bright)" },
  { key: "cancelledCount", colorVar: "var(--bd-red)" },
  { key: "lateCount",      colorVar: "var(--bd-gold-deep)" },
  { key: "temporaryCount", colorVar: "var(--bd-purple)" },
  { key: "convertedCount", colorVar: "var(--bd-teal)" },
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
          style={{ width: 160 }}
        />
      </div>

      {/* Right: 6 counter cards */}
      <div className="reception-counter-cards">
        {COUNTER_CONFIGS.map((c) => (
          <div
            key={c.key}
            className="reception-counter-card"
            style={{ "--counter-color": c.colorVar } as React.CSSProperties}
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
