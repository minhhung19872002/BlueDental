import React, { useMemo, useRef, useEffect } from "react";
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
  { key: "scheduledCount", bg: "#eceefd", border: "#c8cafa", color: "#6366f1" },
  { key: "arrivedCount",   bg: "#e2f4ee", border: "#abddcc", color: "#0e9f6e" },
  { key: "cancelledCount", bg: "#faf1e2", border: "#f2d6ab", color: "#d98b0f" },
  { key: "lateCount",      bg: "#fce9ea", border: "#f6bfc1", color: "#e5484d" },
  { key: "temporaryCount", bg: "#efebfb", border: "#d1c6f4", color: "#7c5ce0" },
  { key: "convertedCount", bg: "#e2f2f9", border: "#abd9ee", color: "#0e94d0" },
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
  const filterLeftRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = filterLeftRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".ant-segmented-item-selected");
    if (!active) return;
    const left = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeTab]);

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
      <div className="reception-filter-left" ref={filterLeftRef}>
        <Segmented
          value={activeTab}
          options={segmentedOptions}
          onChange={(val) => onChange(val as ReceptionStatus)}
        />

        <div className="reception-doctor-filter">
          <SearchSelect
            value={selectedDoctorId}
            placeholder={t("Bác sĩ")}
            allowClear
            options={doctors.map((d) => ({ value: d.id, label: d.name }))}
            onChange={(val) => onDoctorSelect?.(val)}
            style={{ width: 160 }}
          />
        </div>
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
