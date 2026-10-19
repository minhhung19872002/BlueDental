import { t } from "@/lib/i18n";
import { STATUS_TONE } from "@/theme/statusPalette";

interface CounterConfig {
  key: string;
  label: () => string;
  border: string;
  bg: string;
  color: string;
}

const COUNTERS: CounterConfig[] = [
  { key: "scheduled", label: () => t("Appointment:Status:Scheduled2"), ...STATUS_TONE.scheduled },
  { key: "arrived", label: () => t("Appointment:Status:Arrived"), ...STATUS_TONE.arrived },
  { key: "cancelled", label: () => t("Appointment:Status:CancelledShort"), ...STATUS_TONE.cancelled },
  { key: "late", label: () => t("Appointment:Status:Late"), ...STATUS_TONE.late },
  { key: "temporary", label: () => t("Appointment:Status:Temporary"), ...STATUS_TONE.temporary },
  { key: "converted", label: () => t("Appointment:Status:Converted"), ...STATUS_TONE.converted },
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
