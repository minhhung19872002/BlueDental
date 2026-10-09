import type { ReactNode } from "react";
import type { WaitLevel } from "../utils/waitLevel";

interface QueueStatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Colours the value like the wait it reports; plain otherwise. */
  level?: WaitLevel;
}

/** One figure of the queue screens, on the shared KPI tile. */
export function QueueStatTile({ label, value, sub, level }: QueueStatTileProps) {
  return (
    <div
      className={["bd-kpi", "queue-stat", level && `queue-stat--${level}`]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="bd-kpi__label">{label}</div>
      <div className="bd-kpi__value queue-stat__value">{value}</div>
      {sub ? <div className="bd-kpi__sub queue-stat__sub">{sub}</div> : null}
    </div>
  );
}
