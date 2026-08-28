import React, { useMemo } from "react";
import { Segmented } from "antd";
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

type CounterKey = keyof ReceptionCounters;

interface ReceptionStatusTabsProps {
  activeTab: ReceptionStatus;
  activeCounter?: CounterKey;
  metrics?: ReceptionMetrics;
  selectedDoctorId?: string;
  doctors?: DoctorOption[];
  onChange: (status: ReceptionStatus) => void;
  onCounterClick?: (counter: CounterKey) => void;
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

interface StatChipConfig {
  key: keyof ReceptionCounters;
  bg: string;
  border: string;
  color: string;
}

const STAT_CHIP_CONFIGS: StatChipConfig[] = [
  { key: "scheduledCount", bg: "#DCEBFA", border: "#BFD6F6", color: "#1E5BB0" },
  { key: "arrivedCount",   bg: "#DDF3E7", border: "#BDE8CF", color: "#1F7A45" },
  { key: "cancelledCount", bg: "#FBE0E0", border: "#F3BABA", color: "#B93832" },
  { key: "lateCount",      bg: "#F7E7C2", border: "#E8CF92", color: "#9A6A10" },
  { key: "temporaryCount", bg: "#F9E3CC", border: "#E8C19B", color: "#B7611F" },
  { key: "convertedCount", bg: "#D5ECF7", border: "#AAD7EA", color: "#176F99" },
];

const TAB_LABELS: Record<ReceptionStatus, string> = {
  All:            "Tất cả",
  WaitingForExam: "Chờ khám",
  InProgress:     "Đang khám",
  Completed:      "Hoàn thành",
};

export const ReceptionStatusTabs: React.FC<ReceptionStatusTabsProps> = ({
  activeTab,
  activeCounter,
  metrics,
  selectedDoctorId,
  doctors = [],
  onChange,
  onCounterClick,
  onDoctorSelect,
}) => {
  const counters = metrics?.counters;

  const segmentedOptions = useMemo(
    () =>
      TAB_CONFIGS.map((tab) => ({
        value: tab.key,
        label: `${t(TAB_LABELS[tab.key])} (${metrics?.[tab.countKey] ?? 0})`,
      })),
    [metrics],
  );

  const chipLabel: Record<keyof ReceptionCounters, string> = {
    scheduledCount: t("Đã hẹn"),
    arrivedCount:   t("Đã đến"),
    cancelledCount: t("Huỷ hẹn"),
    lateCount:      t("Trễ hẹn"),
    temporaryCount: t("Lịch tạm"),
    convertedCount: t("Chuyển đổi"),
  };

  return (
    <div className="reception-filter-row">
      <div className="reception-filter-left">
        <Segmented
          value={activeTab}
          options={segmentedOptions}
          onChange={(val) => onChange(val as ReceptionStatus)}
        />

        <SearchSelect
          value={selectedDoctorId}
          placeholder={t("Bác sĩ")}
          allowClear
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(val) => onDoctorSelect?.(val)}
          style={{ width: 160 }}
        />
      </div>

      <div className="reception-stat-chips">
        {STAT_CHIP_CONFIGS.map((c) => {
          const isActive = activeCounter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              className={["reception-stat-chip-btn", isActive && "reception-stat-chip-btn--active"].filter(Boolean).join(" ")}
              aria-pressed={isActive}
              onClick={() => onCounterClick?.(c.key)}
            >
              <div
                className="reception-stat-chip"
                style={{
                  "--chip-bg": c.bg,
                  "--chip-border": c.border,
                  "--chip-color": c.color,
                } as React.CSSProperties}
              >
                <span className="reception-stat-chip-value">
                  {counters?.[c.key] ?? 0}
                </span>
                <span className="reception-stat-chip-label">
                  {chipLabel[c.key]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
