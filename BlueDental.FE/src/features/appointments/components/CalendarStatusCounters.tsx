import { t } from "@/lib/i18n";

interface CounterConfig {
  key: string;
  label: () => string;
  border: string;
  bg: string;
  color: string;
}

const COUNTERS: CounterConfig[] = [
  { key: "scheduled", label: () => t("Đã hẹn"), border: "#c8cafa", bg: "#eceefd", color: "#6366f1" },
  { key: "arrived", label: () => t("Đã đến"), border: "#abddcc", bg: "#e2f4ee", color: "#0e9f6e" },
  { key: "cancelled", label: () => t("Huỷ hẹn"), border: "#f2d6ab", bg: "#faf1e2", color: "#d98b0f" },
  { key: "late", label: () => t("Trễ hẹn"), border: "#f6bfc1", bg: "#fce9ea", color: "#e5484d" },
  { key: "temporary", label: () => t("Lịch tạm"), border: "#d1c6f4", bg: "#efebfb", color: "#7c5ce0" },
  { key: "converted", label: () => t("Chuyển đổi"), border: "#abd9ee", bg: "#e2f2f9", color: "#0e94d0" },
];

interface Props {
  counts: Map<string, number>;
  activeKey?: string;
  onToggle: (key: string) => void;
}

export function CalendarStatusCounters({ counts, activeKey, onToggle }: Props) {
  return (
    <div className="cal-toolbar-counters">
      {COUNTERS.map((c) => (
        <button
          key={c.key}
          type="button"
          className={[
            "cal-counter-btn",
            activeKey === c.key && "cal-counter-btn--active",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={activeKey === c.key}
          onClick={() => onToggle(c.key)}
        >
          <div
            className="cal-counter"
            style={{
              "--counter-border": c.border,
              "--counter-bg": c.bg,
              "--counter-color": c.color,
            } as React.CSSProperties}
          >
            <span className="cal-counter-value">{counts.get(c.key) ?? 0}</span>
            <span className="cal-counter-label">{c.label()}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
