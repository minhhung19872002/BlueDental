import { t } from "@/lib/i18n";

interface CounterConfig {
  key: string;
  label: () => string;
  border: string;
  bg: string;
  color: string;
}

const COUNTERS: CounterConfig[] = [
  { key: "scheduled", label: () => t("Đã hẹn"), border: "#BFD6F6", bg: "#DCEBFA", color: "#1E5BB0" },
  { key: "arrived", label: () => t("Đã đến"), border: "#BDE8CF", bg: "#DDF3E7", color: "#1F7A45" },
  { key: "cancelled", label: () => t("Huỷ hẹn"), border: "#F3BABA", bg: "#FBE0E0", color: "#B93832" },
  { key: "late", label: () => t("Trễ hẹn"), border: "#E8CF92", bg: "#F7E7C2", color: "#9A6A10" },
  { key: "temporary", label: () => t("Lịch tạm"), border: "#E8C19B", bg: "#F9E3CC", color: "#B7611F" },
  { key: "converted", label: () => t("Chuyển đổi"), border: "#AAD7EA", bg: "#D5ECF7", color: "#176F99" },
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
