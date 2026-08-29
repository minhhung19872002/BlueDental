import { Tooltip } from "antd";
import type { TimeKeepingSummaryDto } from "../api/timekeepingApi";
import { t } from "@/lib/i18n";

interface ChipConfig {
  key: keyof Omit<TimeKeepingSummaryDto, "workDate">;
  label: () => string;
  border: string;
  bg: string;
  color: string;
  format?: (v: number) => string;
  showAlert?: boolean;
  tooltip?: () => string;
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const CHIPS: ChipConfig[] = [
  { key: "totalStaff", label: () => t("Tổng CBNV"), border: "#BFD6F6", bg: "#DCEBFA", color: "#1E5BB0" },
  { key: "registeredWorking", label: () => t("Đăng kí làm"), border: "#BDE8CF", bg: "#DDF3E7", color: "#1F7A45" },
  { key: "registeredDayOff", label: () => t("Đăng kí nghỉ"), border: "#F3BABA", bg: "#FBE0E0", color: "#B93832" },
  { key: "currentlyWorking", label: () => t("Đang làm việc"), border: "#BDE8CF", bg: "#DDF3E7", color: "#1F7A45" },
  { key: "abandoned", label: () => t("Nghỉ ngang"), border: "#F3BABA", bg: "#FBE0E0", color: "#B93832", showAlert: true, tooltip: () => t("Nhân viên bị hệ thống ghi nhận vắng không báo trước hoặc đã vào ca nhưng qua hết ngày vẫn chưa bấm kết ca.") },
  { key: "totalOvertimeMinutes", label: () => t("Giờ tăng ca"), border: "#E8CF92", bg: "#F7E7C2", color: "#9A6A10", format: formatDuration },
];

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

interface Props {
  summary: TimeKeepingSummaryDto | undefined;
}

export function TimekeepingStatChips({ summary }: Props) {
  return (
    <div className="tk-stat-chips">
      {CHIPS.map((chip) => {
        const raw = summary?.[chip.key] ?? 0;
        const display = chip.format ? chip.format(raw) : raw;

        const el = (
          <div
            key={chip.key}
            className="cal-counter"
            style={{
              "--counter-border": chip.border,
              "--counter-bg": chip.bg,
              "--counter-color": chip.color,
              width: "var(--stat-chip-width, auto)",
            } as React.CSSProperties}
          >
            <span className="cal-counter-value">{display}</span>
            <span className="cal-counter-label">
              <span>{chip.label()}</span>
              {chip.showAlert && <AlertIcon />}
            </span>
          </div>
        );

        if (chip.tooltip) {
          return (
            <Tooltip key={chip.key} title={chip.tooltip()}>
              {el}
            </Tooltip>
          );
        }
        return el;
      })}
    </div>
  );
}
