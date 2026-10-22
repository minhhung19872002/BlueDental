import type { CSSProperties } from "react";

interface Props {
  value: number;
  max: number;
  /** primary = volume, green = arrived, blue = still sending. */
  tone: "primary" | "green" | "blue";
  label: string;
}

/** A thin track filled to value / max — the channel, template and send-result bars. */
export function StatsMeter({ value, max, tone, label }: Props) {
  const fill = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <div
      className={`cskh-stats-meter cskh-stats-meter--${tone}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span className="cskh-stats-meter-fill" style={{ "--fill": `${fill}%` } as CSSProperties} />
    </div>
  );
}
